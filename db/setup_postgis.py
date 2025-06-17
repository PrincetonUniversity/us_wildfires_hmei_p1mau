from sqlalchemy import text
from .database import engine

def setup_postgis():
    """Set up necessary database tables and indexes for spatial data."""
    with engine.connect() as conn:
        # Create geometry column if it doesn't exist
        conn.execute(text("""
        DO $$
        BEGIN
            -- Add geometry column if it doesn't exist
            IF NOT EXISTS (
                SELECT 1 
                FROM information_schema.columns 
                WHERE table_name = 'counties' AND column_name = 'geometry'
            ) THEN
                ALTER TABLE counties ADD COLUMN geometry JSONB;
            END IF;
        END
        $$;
        
        -- Create necessary indexes
        CREATE INDEX IF NOT EXISTS idx_daily_pm25_fips ON daily_pm25(fips);
        CREATE INDEX IF NOT EXISTS idx_daily_pm25_date ON daily_pm25(date);
        CREATE INDEX IF NOT EXISTS idx_population_fips_year ON population(fips, year);
        CREATE INDEX IF NOT EXISTS idx_counties_geometry_gin ON counties USING GIN(geometry);
        """))
        
        
        conn.commit()
        print("Database setup completed successfully.")

if __name__ == "__main__":
    setup_postgis()
