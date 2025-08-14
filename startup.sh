#!/bin/bash
set -e

echo "Starting PM2.5 Wildfire Dashboard Backend..."

# Create data directory if it doesn't exist
mkdir -p /app/data

# Check if data directory exists and is not empty
if [ ! "$(ls -A /app/data)" ]; then
    echo "Data directory is empty. Extracting data from local data.zip..."

    # Check if data.zip exists in the container
    if [ -f "/app/data.zip" ]; then
        echo "Found local data.zip"
        echo "File size: $(ls -lh /app/data.zip | awk '{print $5}')"
        echo "File type: $(file /app/data.zip)"

        # Test the zip file first
        echo "Testing zip file integrity..."
        if unzip -t /app/data.zip > /dev/null 2>&1; then
            echo "Zip file integrity test passed. Extracting..."
            cd /app
            unzip -q data.zip || {
                echo "ERROR: Failed to extract data.zip"
                echo "Attempting verbose extraction for debugging..."
                unzip data.zip
                exit 1
            }
            echo "Data extraction completed successfully."
            echo "Data directory contents:"
            ls -la /app/data/
        else
            echo "ERROR: Zip file integrity test failed"
            echo "Zip file details:"
            ls -la /app/data.zip
            file /app/data.zip
            echo "Attempting to show zip file contents:"
            unzip -l /app/data.zip | head -20
            exit 1
        fi
    else
        echo "ERROR: data.zip not found in container. Please ensure data.zip is included in the Docker image."
        echo "Contents of /app directory:"
        ls -la /app/
        exit 1
    fi
else
    echo "Data directory already exists with content. Skipping extraction."
    echo "Data directory contents:"
    ls -la /app/data/
fi

# Wait for database to be ready
echo "Waiting for database connection..."
python -c "
import time
import psycopg2
import os
import sys

DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    print('ERROR: DATABASE_URL environment variable not set')
    sys.exit(1)

max_retries = 30
retry_count = 0

while retry_count < max_retries:
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.close()
        print('Database connection successful!')
        break
    except psycopg2.OperationalError as e:
        retry_count += 1
        print(f'Database connection attempt {retry_count}/{max_retries} failed: {e}')
        if retry_count >= max_retries:
            print('ERROR: Could not connect to database after maximum retries')
            sys.exit(1)
        time.sleep(2)
"

# Check if database tables exist and have data
echo "Checking database schema and data..."
set +e  # Temporarily disable exit on error to capture exit code
python -c "
import os
import sys
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv('DATABASE_URL')
engine = create_engine(DATABASE_URL)

try:
    # Check if core tables exist and have data
    with engine.connect() as conn:
        # Check if counties table exists and has data
        result = conn.execute(text(\"\"\"
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'counties'
            )
        \"\"\")).scalar()

        if not result:
            print('Database tables do not exist. Database needs to be initialized.')
            sys.exit(2)

        # Check if counties table has data
        result = conn.execute(text('SELECT COUNT(*) FROM counties')).scalar()
        if result == 0:
            print('Counties table exists but is empty. Database needs to be populated.')
            sys.exit(2)

        # Check if yearly_pm25_summary table exists and has data
        result = conn.execute(text(\"\"\"
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'yearly_pm25_summary'
            )
        \"\"\")).scalar()

        if not result:
            print('Summary tables do not exist. Database needs preprocessing.')
            sys.exit(2)

        result = conn.execute(text('SELECT COUNT(*) FROM yearly_pm25_summary')).scalar()
        if result == 0:
            print('Summary tables exist but are empty. Database needs preprocessing.')
            sys.exit(2)

        print(f'Database appears to be properly initialized with {result} yearly summary records.')

except Exception as e:
    print(f'Database check failed: {e}')
    sys.exit(1)
"

DB_CHECK_EXIT_CODE=$?
set -e  # Re-enable exit on error

if [ $DB_CHECK_EXIT_CODE -eq 2 ]; then
    echo "Database needs initialization. This may take several minutes..."
    echo "Note: For production deployments, consider running data loading as a separate initialization job."

    # Run database initialization
    python -c "
import sys
import os
sys.path.append('/app')

# Import the data loader
from db.load_data import DataLoader

print('Starting database initialization...')
try:
    with DataLoader() as loader:
        print('Creating database tables...')
        loader.create_tables()

        print('Loading counties...')
        loader.load_counties()

        print('Loading population data (2006-2008 from CSV)...')
        loader.load_population_data()

        print('Loading population data (2009-2023 from Census API)...')
        # Check if Census API key is available
        if os.getenv('CENSUS_API_KEY'):
            loader.load_population_data_api()
        else:
            print('WARNING: CENSUS_API_KEY not set. Skipping Census API population data (2009-2023).')
            print('The application will only have population data for 2006-2008.')

        print('Loading PM2.5 data...')
        loader.load_pm25_data()

        print('Creating indexes...')
        loader.create_indexes()

        print('Generating aggregations...')
        loader.preprocess_aggregations()

        print('Loading baseline mortality...')
        loader.load_baseline_mortality()

        print('Loading fire attribution bins...')
        loader.load_fire_attribution_bins()

        print('Computing excess mortality summary...')
        loader.excess_mortality_summary()

        print('Loading exceedance summary...')
        loader.load_exceedance_summary()

        print('Loading decomposition summary...')
        loader.load_decomposition_summary()

        print('Validating data...')
        loader.validate_data()

    print('Database initialization completed successfully!')

except Exception as e:
    print(f'Database initialization failed: {e}')
    import traceback
    traceback.print_exc()
    sys.exit(1)
"

    if [ $? -ne 0 ]; then
        echo "ERROR: Database initialization failed"
        exit 1
    fi
elif [ $DB_CHECK_EXIT_CODE -ne 0 ]; then
    echo "ERROR: Database check failed"
    exit 1
fi

# If database initialized, optionally backfill missing Census API population years (2009-2023)
if [ $DB_CHECK_EXIT_CODE -eq 0 ]; then
    if [ -n "${CENSUS_API_KEY}" ]; then
        echo "Checking for missing Census population years (2009-2023) to backfill..."
        python -c "
import os
from sqlalchemy import create_engine, text
from db.database import SessionLocal
from db.load_data import DataLoader

engine = create_engine(os.getenv('DATABASE_URL'))
with engine.connect() as conn:
        existing_years = conn.execute(text('SELECT DISTINCT year FROM population WHERE year BETWEEN 2009 AND 2023 ORDER BY year')).fetchall()
        existing_years = sorted({r[0] for r in existing_years})
        target_years = list(range(2009, 2024))
        missing = [y for y in target_years if y not in existing_years]
        print(f'Existing Census population years in DB: {existing_years}')
        if missing:
                print(f'Missing years will be backfilled via Census API: {missing}')
                with DataLoader() as loader:
                        loader.load_population_data_api(restrict_years=missing)
                        # Refresh aggregations only if we added new population data
                        print('Recomputing aggregations after population backfill...')
                        loader.preprocess_aggregations()
        else:
                print('No Census population backfill needed.')
"
    else
        echo "CENSUS_API_KEY not set; skipping Census population backfill check."
    fi
fi

echo "Starting the application..."
exec python app.py