import os
import sys
import logging
import argparse
from datetime import datetime, date
from typing import Optional, Dict, Any, List, Tuple

import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from sqlalchemy.orm import Session, sessionmaker
from tqdm import tqdm

from .models import DailyPM25, County, Population

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('data_loading.log')
    ]
)
logger = logging.getLogger(__name__)

def get_db_connection():
    """Create a database connection."""
    from db.database import engine, SessionLocal
    return SessionLocal()

def parse_date(row: pd.Series) -> Optional[date]:
    """Parse date from year, month, day columns."""
    try:
        # Check for NaN values in any of the date components
        if pd.isna(row['Year']) or pd.isna(row['Month']) or pd.isna(row['Day']):
            logger.debug(f"Skipping row with missing date components: {row.to_dict()}")
            return None
            
        year = int(float(row['Year']))
        month = int(float(row['Month']))
        day = int(float(row['Day']))
        
        # Basic validation of date components
        if not (1 <= month <= 12) or not (1 <= day <= 31) or year < 1900 or year > 2100:
            logger.warning(f"Invalid date values - Year: {year}, Month: {month}, Day: {day}")
            return None
            
        return date(year, month, day)
        
    except (ValueError, TypeError, KeyError) as e:
        logger.warning(f"Error parsing date from row: {row.to_dict()}. Error: {str(e)}")
        return None

def load_daily_pm25(session: Session, csv_path: str, batch_size: int = 1000, skip_existing: bool = True) -> Tuple[int, int]:
    """
    Load daily PM2.5 data from CSV to database.
    
    Args:
        session: Database session
        csv_path: Path to the CSV file
        batch_size: Number of records to insert in each batch
        skip_existing: Skip records that already exist in the database
        
    Returns:
        Tuple of (records_processed, records_inserted)
    """
    try:
        if not os.path.exists(csv_path):
            logger.error(f"CSV file not found: {csv_path}")
            return 0, 0
            
        logger.info(f"Reading data from {csv_path}")
        df = pd.read_csv(csv_path, dtype={'FIPS': str})
        
        # Parse dates and filter out invalid rows
        df['date'] = df.apply(parse_date, axis=1)
        df = df[df['date'].notna()].copy()
        
        if df.empty:
            logger.warning("No valid data to load")
            return 0, 0
            
        # Ensure all CSV columns are present
        required_csv_columns = ['Year', 'Month', 'Day', 'Value', 'fire_pm25', 'FIPS', 'County', 'CountyIndex']
        if not all(col in df.columns for col in required_csv_columns):
            missing = [col for col in required_csv_columns if col not in df.columns]
            logger.error(f"Missing required columns in CSV: {missing}")
            return 0, 0
            
        # Convert data types and clean data
        df['CountyIndex'] = pd.to_numeric(df['CountyIndex'], errors='coerce').fillna(-1).astype(int)
        df['Value'] = pd.to_numeric(df['Value'], errors='coerce')
        df['fire_pm25'] = pd.to_numeric(df['fire_pm25'], errors='coerce').fillna(0)
        
        # Filter out any rows with invalid PM2.5 values
        valid_pm25 = df['Value'].notna() & (df['Value'] >= 0)
        df = df[valid_pm25].copy()
        
        if df.empty:
            logger.warning("No valid PM2.5 data to load after filtering")
            return 0, 0
            
        # Process in batches
        total_records = len(df)
        inserted_count = 0
        
        logger.info(f"Starting to load {total_records} records in batches of {batch_size}")
        
        # Process in batches
        for i in tqdm(range(0, total_records, batch_size), desc="Loading data"):
            batch = df.iloc[i:i + batch_size].copy()
            
            try:
                # Prepare batch records - matching database schema
                records = []
                for _, row in batch.iterrows():
                    try:
                        # Calculate nonfire value
                        value = float(row['Value'])
                        fire_value = float(row['fire_pm25'])
                        nonfire_value = value - fire_value
                        
                        record = {
                            'date': row['date'],
                            'total': value,  # Matches 'total' column in DB
                            'fire': fire_value,  # Matches 'fire' column in DB
                            'nonfire': nonfire_value,  # Matches 'nonfire' column in DB
                            'fips': str(row['FIPS']).strip().zfill(5),  # Ensure proper FIPS formatting
                            'county_index': int(row['CountyIndex'])  # Add county_index for easier matching
                        }
                        records.append(record)
                    except (ValueError, KeyError) as e:
                        logger.debug(f"Skipping invalid record: {row.to_dict()}. Error: {e}")
                        continue
                
                # Convert records to model instances
                pm25_instances = []
                for record in records:
                    pm25 = DailyPM25(
                        date=record['date'],
                        total=record['total'],
                        fire=record['fire'],
                        nonfire=record['nonfire'],
                        fips=record['fips'],
                        county_index=record['county_index']
                    )
                    pm25_instances.append(pm25)
                
                # Add all instances to session
                session.add_all(pm25_instances)
                
                try:
                    session.commit()
                    inserted_count += len(pm25_instances)
                except IntegrityError:
                    if skip_existing:
                        # If we hit a duplicate and skip_existing is True, rollback and try one by one
                        session.rollback()
                        for instance in pm25_instances:
                            try:
                                session.merge(instance)
                                session.commit()
                                inserted_count += 1
                            except IntegrityError:
                                session.rollback()
                                continue
                    else:
                        # If skip_existing is False, let the error propagate
                        session.rollback()
                        raise
                    
            except Exception as e:
                session.rollback()
                logger.error(f"Error inserting batch {i//batch_size + 1}: {e}")
                continue
        
        logger.info(f"Successfully loaded {inserted_count} out of {total_records} records")
        return total_records, inserted_count
        
    except Exception as e:
        logger.error(f"Error in load_daily_pm25: {e}", exc_info=True)
        session.rollback()
        return 0, 0

def load_population_data(session: Session, csv_path: str) -> Tuple[int, int]:
    """Load population data from CSV to database."""
    try:
        if not os.path.exists(csv_path):
            logger.error(f"Population CSV file not found: {csv_path}")
            return 0, 0
            
        logger.info(f"Loading population data from {csv_path}")
        df = pd.read_csv(csv_path)
        
        # Ensure required columns exist
        required_columns = ['county_index', 'year', 'population']
        if not all(col in df.columns for col in required_columns):
            missing = [col for col in required_columns if col not in df.columns]
            logger.error(f"Missing required columns: {missing}")
            return 0, 0
        
        # Get county mapping
        county_map = {c.index: c.fips for c in session.query(County).all()}
        
        total_records = len(df)
        inserted_count = 0
        
        for _, row in tqdm(df.iterrows(), total=total_records, desc="Loading population data"):
            try:
                fips = county_map.get(int(row['county_index']))
                if not fips:
                    logger.warning(f"No FIPS found for county_index {row['county_index']}")
                    continue
                
                # Check if record already exists
                exists = session.query(Population).filter_by(
                    fips=fips,
                    year=int(row['year'])
                ).first()
                
                if exists:
                    # Update existing record
                    exists.population = int(row['population'])
                else:
                    # Insert new record
                    record = Population(
                        fips=fips,
                        year=int(row['year']),
                        population=int(row['population'])
                    )
                    session.add(record)
                
                inserted_count += 1
                
                # Commit periodically
                if inserted_count % 1000 == 0:
                    session.commit()
                    
            except Exception as e:
                session.rollback()
                logger.error(f"Error processing row {row.to_dict()}: {e}")
                continue
        
        session.commit()
        logger.info(f"Successfully processed {inserted_count} out of {total_records} population records")
        return total_records, inserted_count
        
    except Exception as e:
        logger.error(f"Error in load_population_data: {e}", exc_info=True)
        session.rollback()
        return 0, 0

def main():
    """Main function to handle command line arguments."""
    parser = argparse.ArgumentParser(description='Load PM2.5 and population data into the database.')
    parser.add_argument('--fips-csv', default='data/FIPScode.csv',
                      help='Path to FIPS codes CSV file (default: data/FIPScode.csv)')
    parser.add_argument('--pm25-csv', default='data/daily_county_data_combined.csv',
                      help='Path to PM2.5 data CSV file (default: data/daily_county_data_combined.csv)')
    parser.add_argument('--population-csv', default='data/population_2013_2023.csv',
                      help='Path to population data CSV file (default: data/population_2013_2023.csv)')
    parser.add_argument('--batch-size', type=int, default=1000,
                      help='Number of records to process in each batch (default: 1000)')
    parser.add_argument('--skip-existing', action='store_true',
                      help='Skip records that already exist in the database')
    
    args = parser.parse_args()
    
    db = get_db_connection()
    try:
        logger.info("Starting data loading process")
        
        # First load counties
        from .load_counties import load_counties as load_counties_func
        logger.info(f"Loading counties data from {args.fips_csv}...")
        total_counties, loaded_counties = load_counties_func(db, args.fips_csv)
        logger.info(f"Loaded {loaded_counties} out of {total_counties} counties.")
        
        # Then load PM2.5 data
        logger.info("Loading PM2.5 data...")
        total_pm25, inserted_pm25 = load_daily_pm25(
            db, 
            args.pm25_csv, 
            batch_size=args.batch_size,
            skip_existing=args.skip_existing
        )
        
        # Finally load population data
        logger.info("Loading population data...")
        total_pop, inserted_pop = load_population_data(
            db,
            args.population_csv
        )
        
        logger.info(f"Data loading completed. "
                   f"Counties: {loaded_counties}/{total_counties}, "
                   f"PM2.5: {inserted_pm25}/{total_pm25}, "
                   f"Population: {inserted_pop}/{total_pop}")
                   
    except Exception as e:
        logger.error(f"Error in main: {e}", exc_info=True)
        return 1
    finally:
        db.close()
    
    return 0

if __name__ == "__main__":
    sys.exit(main())