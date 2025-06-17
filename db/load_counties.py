import csv
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from .models import County

def load_counties(session: Session, csv_path: str) -> tuple[int, int]:
    """
    Load county data from FIPScode.csv file into the database.
    
    Args:
        session: Database session
        csv_path: Path to the FIPScode.csv file containing FIPS and county names
        
    Returns:
        Tuple of (total_counties, loaded_counties)
    """
    try:
        # Read the CSV file with explicit column names
        with open(csv_path, 'r', encoding='utf-8-sig') as f:  # utf-8-sig to handle BOM
            # Read all non-empty lines
            lines = [line.strip() for line in f if line.strip()]
            
        # Process lines into FIPS and county name pairs
        counties_data = []
        for idx, line in enumerate(lines, 1):
            # Skip header if present
            if idx == 1 and ('FIPS' in line or 'fips' in line.lower()):
                continue
                
            # Split on first comma only
            parts = line.strip().split(',', 1)
            if len(parts) == 2:
                fips, name = parts
                fips = fips.strip()
                name = name.strip()
                
                # Skip empty lines or invalid FIPS
                if not fips or not name:
                    logging.warning(f"Skipping invalid line: {line}")
                    continue
                    
                # Ensure FIPS is 5 digits (pad with leading zeros if needed)
                try:
                    fips = fips.zfill(5)
                    # Add to counties data with 1-based index
                    counties_data.append({
                        'fips': fips, 
                        'name': name,
                        'index': idx
                    })
                except ValueError as e:
                    logging.warning(f"Invalid FIPS code '{fips}': {e}")
                    continue
        
        if not counties_data:
            logging.warning("No county data found in the CSV file.")
            return 0, 0
            
        total_counties = len(counties_data)
        loaded_counties = 0
        
        for county_data in counties_data:
            try:
                fips = county_data['fips']
                name = county_data['name']
                county_index = county_data['index']
                
                # Check if county already exists
                existing = session.query(County).filter_by(fips=fips).first()
                
                if existing:
                    # Update existing record
                    if existing.name != name or existing.index != county_index:
                        existing.name = name
                        existing.index = county_index
                        session.add(existing)
                else:
                    # Create new record
                    county = County(
                        fips=fips,
                        name=name,
                        index=county_index
                    )
                    session.add(county)
                
                loaded_counties += 1
                
                # Commit every 100 records
                if loaded_counties % 100 == 0:
                    session.commit()
                    
            except Exception as e:
                logging.error(f"Error processing county data {row}: {e}")
                session.rollback()
                continue
        
        # Final commit
        session.commit()
        logging.info(f"Successfully loaded {loaded_counties} out of {total_counties} counties.")
        return total_counties, loaded_counties
        
    except Exception as e:
        logging.error(f"Error in load_counties: {e}", exc_info=True)
        session.rollback()
        return 0, 0

def main():
    """Command line interface for loading county data."""
    import argparse
    from .database import SessionLocal
    
    parser = argparse.ArgumentParser(description='Load county data into the database.')
    parser.add_argument('--csv', default='data/counties.csv',
                      help='Path to counties CSV file')
    args = parser.parse_args()
    
    db = SessionLocal()
    try:
        total, loaded = load_counties(db, args.csv)
        print(f"Processed {loaded} out of {total} counties.")
    except Exception as e:
        print(f"Error: {e}")
        return 1
    finally:
        db.close()
    
    return 0

if __name__ == "__main__":
    import sys
    sys.exit(main())
