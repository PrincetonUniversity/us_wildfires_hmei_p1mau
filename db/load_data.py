import pandas as pd
import numpy as np
import geopandas as gpd
from datetime import datetime, date
from sqlalchemy.orm import Session
from sqlalchemy import text
import logging
from pathlib import Path
import sys
import json
from typing import Optional

# Import your models and database
from .models import (
    Base, County, DailyPM25, Population, Demographics,
    YearlyPM25Summary, MonthlyPM25Summary, SeasonalPM25Summary,
    AnnualHealthMetric, BaselineMortalityRate
)
from .database import engine, SessionLocal

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('data_loading.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class DataLoader:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = Path(data_dir)
        self.db = SessionLocal()
        
    def __enter__(self):
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.db.close()

    def create_tables(self):
        """Drop tables if they exist"""
        logger.info("Dropping tables if they exist...")
        Base.metadata.drop_all(bind=engine)
        logger.info("Tables dropped successfully")
        """Create all database tables"""
        logger.info("Creating database tables...")
        Base.metadata.create_all(bind=engine)
        logger.info("Tables created successfully")

    def load_shapefiles(self, shapefile_path: Optional[str] = None):
        """Load county geometries from shapefile"""
        if shapefile_path is None:
            shapefile_path = self.data_dir / "shapefiles" / "cb_2018_us_county_20m.shp"
            
        logger.info(f"Loading county geometries from {shapefile_path}")
        
        try:
            # Read shapefile
            gdf = gpd.read_file(shapefile_path)
            
            # The Census shapefile uses GEOID for FIPS codes
            if 'GEOID' in gdf.columns:
                gdf['FIPS'] = gdf['GEOID']
            elif 'FIPS' not in gdf.columns:
                logger.error("Could not find FIPS/GEOID column in shapefile")
                return
                
            # Ensure FIPS is string and properly formatted
            gdf['FIPS'] = gdf['FIPS'].astype(str).str.zfill(5)
            
            # Simplify geometries for better performance (optional)
            # gdf['geometry'] = gdf['geometry'].simplify(tolerance=0.01)
            
            # Convert to WGS84 if not already
            if gdf.crs != 'EPSG:4326':
                gdf = gdf.to_crs('EPSG:4326')
            
            logger.info(f"Found {len(gdf)} counties in shapefile")
            
            # Convert geometries to GeoJSON and update database
            updated_count = 0
            for _, row in gdf.iterrows():
                try:
                    # Convert geometry to GeoJSON
                    geojson = json.loads(gpd.GeoSeries([row.geometry]).to_json())
                    geometry_dict = geojson['features'][0]['geometry']
                    
                    # Update county with geometry
                    county = self.db.query(County).filter(County.fips == row['FIPS']).first()
                    if county:
                        county.geometry = geometry_dict
                        updated_count += 1
                    else:
                        logger.warning(f"County with FIPS {row['FIPS']} not found in database")
                        
                except Exception as e:
                    logger.warning(f"Error processing geometry for FIPS {row['FIPS']}: {e}")
                    continue
                    
                # Commit every 100 updates
                if updated_count % 100 == 0:
                    self.db.commit()
                    logger.info(f"Updated {updated_count} county geometries...")
            
            # Final commit
            self.db.commit()
            logger.info(f"Successfully updated {updated_count} counties with geometries")
            
        except Exception as e:
            logger.error(f"Error loading shapefiles: {e}")
            self.db.rollback()
            raise

    def load_counties(self, fips_filepath: Optional[str] = None, shapefile_path: Optional[str] = None):
        """Load county data from FIPScode.csv and geometries from shapefile"""
        if fips_filepath is None:
            fips_filepath = self.data_dir / "FIPScode.csv"
        if shapefile_path is None:
            shapefile_path = self.data_dir / "shapefiles" / "cb_2018_us_county_20m.shp"
            
        logger.info(f"Loading counties from {fips_filepath}")
        
        try:
            # Read FIPS codes CSV
            df = pd.read_csv(fips_filepath, dtype={'FIPS': str})
            
            # Clean column names (remove quotes if present)
            df.columns = df.columns.str.strip().str.replace('"', '')
            
            # Ensure FIPS is properly formatted (5-digit string with leading zeros)
            df['FIPS'] = df['FIPS'].str.zfill(5)
            
            # Read shapefile for geometries
            logger.info(f"Reading shapefile from {shapefile_path}")
            gdf = gpd.read_file(shapefile_path)
            
            # Handle FIPS column name in shapefile
            if 'GEOID' in gdf.columns:
                gdf['FIPS'] = gdf['GEOID']
            elif 'FIPS' not in gdf.columns:
                logger.warning("No FIPS/GEOID column found in shapefile")
                gdf['FIPS'] = None
            
            if gdf['FIPS'] is not None:
                gdf['FIPS'] = gdf['FIPS'].astype(str).str.zfill(5)
                
                # Convert to WGS84 if needed
                if gdf.crs != 'EPSG:4326':
                    gdf = gdf.to_crs('EPSG:4326')
                
                # Create geometry lookup
                geometry_lookup = {}
                for _, row in gdf.iterrows():
                    try:
                        geojson = json.loads(gpd.GeoSeries([row.geometry]).to_json())
                        geometry_lookup[row['FIPS']] = geojson['features'][0]['geometry']
                    except:
                        continue
                        
                logger.info(f"Loaded {len(geometry_lookup)} geometries from shapefile")
            
            logger.info(f"Found {len(df)} counties to load")
            
            # Batch insert counties with geometries
            counties_to_insert = []
            for idx, row in df.iterrows():
                geometry = geometry_lookup.get(row['FIPS']) if 'geometry_lookup' in locals() else None
                
                county = County(
                    fips=row['FIPS'],
                    name=row['name'],
                    index=idx + 1,
                    geometry=geometry
                )
                counties_to_insert.append(county)
                
                # Batch insert every 1000 records
                if len(counties_to_insert) >= 1000:
                    self.db.bulk_save_objects(counties_to_insert)
                    self.db.commit()
                    counties_to_insert = []
                    logger.info(f"Inserted {idx + 1} counties...")
            
            # Insert remaining counties
            if counties_to_insert:
                self.db.bulk_save_objects(counties_to_insert)
                self.db.commit()
                
            # Count how many have geometries
            counties_with_geom = sum(1 for c in counties_to_insert if c.geometry is not None)
            logger.info(f"Successfully loaded {len(df)} counties ({counties_with_geom} with geometries)")
            
        except Exception as e:
            logger.error(f"Error loading counties: {e}")
            self.db.rollback()
            raise

    def load_population_data(self, filepath: Optional[str] = None):
        """Load population data from population_2013_2023.csv"""
        if filepath is None:
            filepath = self.data_dir / "population_2013_2023.csv"
            
        logger.info(f"Loading population data from {filepath}")
        
        try:
            df = pd.read_csv(filepath)
            
            # Clean column names - remove quotes and whitespace
            df.columns = df.columns.str.strip().str.replace('"', '')
            logger.info(f"CSV columns: {list(df.columns)}")
            
            # Debug: Show first few rows
            logger.info(f"First 3 rows of population data:")
            logger.info(df.head(3).to_string())
            
            # Create a mapping from county_index to FIPS
            county_mapping = {}
            counties = self.db.query(County.index, County.fips).all()
            for county in counties:
                county_mapping[county.index] = county.fips
                
            logger.info(f"Created county mapping for {len(county_mapping)} counties")
            logger.info(f"Sample county mapping: {dict(list(county_mapping.items())[:5])}")
            logger.info(f"Found {len(df)} population records to load")
            
            # Prepare population data
            population_data = []
            processed_count = 0
            matched_count = 0
            
            for _, row in df.iterrows():
                processed_count += 1
                
                try:
                    county_index = int(row['county_index'])
                    
                    # Convert year_index to actual year
                    # Based on your example: year_index 24 = year 2013
                    # So the formula appears to be: year = year_index + 1989
                    year_index = int(row['year_index'])
                    actual_year = year_index + 1989
                    
                    # Verify with the 'year' column if it exists
                    if 'year' in row and pd.notna(row['year']):
                        expected_year = int(row['year'])
                        if actual_year != expected_year:
                            logger.warning(f"Year calculation mismatch: year_index {year_index} -> calculated {actual_year}, but CSV says {expected_year}")
                            actual_year = expected_year  # Use the CSV year if there's a mismatch
                    
                    if county_index in county_mapping:
                        matched_count += 1
                        pop_record = Population(
                            fips=county_mapping[county_index],
                            year=actual_year,
                            population=int(row['population']) if pd.notna(row['population']) else 0
                        )
                        population_data.append(pop_record)
                        
                        # Debug: Log first few matches
                        if matched_count <= 5:
                            logger.info(f"Match {matched_count}: county_index={county_index} -> fips={county_mapping[county_index]}, year_index={year_index} -> year={actual_year}, pop={row['population']}")
                            
                    else:
                        logger.warning(f"County index {county_index} not found in counties table")
                        
                    # Batch insert every 1000 records
                    if len(population_data) >= 1000:
                        self.db.bulk_save_objects(population_data)
                        self.db.commit()
                        logger.info(f"Inserted batch of {len(population_data)} population records...")
                        population_data = []
                        
                except Exception as e:
                    logger.warning(f"Error processing row {processed_count}: {e}")
                    logger.warning(f"Row data: {dict(row)}")
                    continue
            
            # Insert remaining records
            if population_data:
                self.db.bulk_save_objects(population_data)
                self.db.commit()
                logger.info(f"Inserted final batch of {len(population_data)} population records")
                
            logger.info(f"Population loading summary:")
            logger.info(f"  Total rows processed: {processed_count}")
            logger.info(f"  Successfully matched: {matched_count}")
            logger.info(f"  Records inserted: {matched_count}")
            
            # Verify insertion
            total_in_db = self.db.query(Population).count()
            logger.info(f"Total population records in database: {total_in_db}")
            
        except Exception as e:
            logger.error(f"Error loading population data: {e}")
            self.db.rollback()
            raise

    def load_pm25_data(self, filepath: Optional[str] = None, chunk_size: int = 10000):
        """Load PM2.5 data from daily_county_data_combined.csv"""
        if filepath is None:
            filepath = self.data_dir / "daily_county_data_combined.csv"
            
        logger.info(f"Loading PM2.5 data from {filepath}")
        
        try:
            # Read CSV in chunks to handle large file
            total_records = 0
            chunk_count = 0
            
            for chunk in pd.read_csv(filepath, chunksize=chunk_size, dtype={'FIPS': str}):
                chunk_count += 1
                logger.info(f"Processing chunk {chunk_count} ({len(chunk)} records)")
                
                # Clean column names
                chunk.columns = chunk.columns.str.strip().str.replace('"', '')
                
                # Ensure FIPS is properly formatted
                chunk['FIPS'] = chunk['FIPS'].str.zfill(5)
                
                # Create date column
                chunk['date'] = pd.to_datetime(
                    chunk[['Year', 'Month', 'Day']], 
                    errors='coerce'
                )
                
                # Remove rows with invalid dates
                chunk = chunk.dropna(subset=['date'])
                
                # Calculate non-fire PM2.5
                chunk['nonfire_pm25'] = chunk['total_value'] - chunk['fire_pm25']
                chunk['nonfire_pm25'] = chunk['nonfire_pm25'].clip(lower=0)  # Ensure non-negative
                
                # Prepare PM2.5 records
                pm25_records = []
                for _, row in chunk.iterrows():
                    try:
                        pm25_record = DailyPM25(
                            fips=row['FIPS'],
                            county_index=int(row['county_index']),
                            date=row['date'].date(),
                            total=float(row['total_value']) if pd.notna(row['total_value']) else 0.0,
                            fire=float(row['fire_pm25']) if pd.notna(row['fire_pm25']) else 0.0,
                            nonfire=float(row['nonfire_pm25']) if pd.notna(row['nonfire_pm25']) else 0.0
                        )
                        pm25_records.append(pm25_record)
                    except Exception as e:
                        logger.warning(f"Skipping invalid record: {e}")
                        continue
                
                # Bulk insert
                if pm25_records:
                    self.db.bulk_save_objects(pm25_records)
                    self.db.commit()
                    total_records += len(pm25_records)
                    logger.info(f"Inserted {len(pm25_records)} PM2.5 records (Total: {total_records})")
                
            logger.info(f"Successfully loaded {total_records} PM2.5 records")
            
        except Exception as e:
            logger.error(f"Error loading PM2.5 data: {e}")
            self.db.rollback()
            raise

    def create_indexes(self):
        """Create additional indexes for performance"""
        logger.info("Creating additional indexes...")
        
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_daily_pm25_date_fips ON daily_pm25(date, fips);",
            "CREATE INDEX IF NOT EXISTS idx_daily_pm25_fips_date ON daily_pm25(fips, date);",
            "CREATE INDEX IF NOT EXISTS idx_daily_pm25_year_fips ON daily_pm25(EXTRACT(year FROM date), fips);",
            "CREATE INDEX IF NOT EXISTS idx_daily_pm25_year_month_fips ON daily_pm25(EXTRACT(year FROM date), EXTRACT(month FROM date), fips);",
            "CREATE INDEX IF NOT EXISTS idx_yearly_summary_year ON yearly_pm25_summary(year);",
            "CREATE INDEX IF NOT EXISTS idx_monthly_summary_year_month ON monthly_pm25_summary(year, month);",
            "CREATE INDEX IF NOT EXISTS idx_seasonal_summary_year_season ON seasonal_pm25_summary(year, season);",
        ]
        
        for index_sql in indexes:
            try:
                self.db.execute(text(index_sql))
                self.db.commit()
                logger.info(f"Created index: {index_sql.split('ON')[1].split('(')[0].strip()}")
            except Exception as e:
                logger.warning(f"Index creation failed (may already exist): {e}")

    def load_baseline_mortality(self, filepath: Optional[str] = None):
        """Load baseline mortality rates from all_basemor_results.csv"""
        if filepath is None:
            filepath = self.data_dir / "all_basemor_results.csv"
        logger.info(f"Loading baseline mortality rates from {filepath}")

        try:
            df = pd.read_csv(filepath)
            # Clean column names
            df.columns = df.columns.str.strip().str.replace('"', '')

            # Build county index -> FIPS mapping
            county_mapping = {c.index: c.fips for c in self.db.query(County.index, County.fips).all()}

            records = []
            for _, row in df.iterrows():
                county_index = int(row['county'])
                fips = county_mapping.get(county_index)
                if not fips:
                    logger.warning(f"County index {county_index} not found in counties table, skipping.")
                    continue
                record = BaselineMortalityRate(
                    fips=fips,
                    county_index=county_index,
                    year=int(row['year']),
                    age_group=int(row['age_group']),
                    stat_type=str(row['stat']),
                    value=float(row['value']),
                    source=str(row['source']),
                    allage_flag="allage" in str(row['source']).lower()
                )
                records.append(record)
                if len(records) >= 1000:
                    self.db.bulk_save_objects(records)
                    self.db.commit()
                    logger.info(f"Inserted {len(records)} baseline mortality records...")
                    records = []
            if records:
                self.db.bulk_save_objects(records)
                self.db.commit()
                logger.info(f"Inserted final {len(records)} baseline mortality records.")
            logger.info("Baseline mortality loading complete.")
        except Exception as e:
            logger.error(f"Error loading baseline mortality rates: {e}")
            self.db.rollback()
            raise

    def preprocess_aggregations(self):
        """Generate pre-aggregated tables for fast queries, including population-weighted metrics"""
        logger.info("Starting aggregation preprocessing...")
        try:
            # Clear existing aggregations
            logger.info("Clearing existing aggregations...")
            self.db.query(YearlyPM25Summary).delete()
            self.db.query(MonthlyPM25Summary).delete()
            self.db.query(SeasonalPM25Summary).delete()
            self.db.commit()

            # Preload population data for all counties/years
            logger.info("Preloading population data for all counties/years...")
            pop_lookup = {}
            for pop in self.db.query(Population).all():
                pop_lookup[(pop.fips, pop.year)] = pop.population

            # YEARLY AGGREGATIONS
            logger.info("Processing yearly aggregations...")
            yearly_results = self.db.execute(text("""
                SELECT 
                    fips,
                    EXTRACT(year FROM date) as year,
                    AVG(total) as avg_total,
                    AVG(fire) as avg_fire,
                    AVG(nonfire) as avg_nonfire,
                    MAX(total) as max_total,
                    MAX(fire) as max_fire,
                    MAX(nonfire) as max_nonfire,
                    COUNT(*) as days_count
                FROM daily_pm25
                GROUP BY fips, EXTRACT(year FROM date)
            """)).fetchall()
            yearly_summaries = []
            for row in yearly_results:
                fips = row.fips
                year = int(row.year)
                population = pop_lookup.get((fips, year), 0)
                pop_weighted_total = (row.avg_total or 0) * population if population else 0
                pop_weighted_fire = (row.avg_fire or 0) * population if population else 0
                pop_weighted_nonfire = (row.avg_nonfire or 0) * population if population else 0
                yearly_summaries.append(YearlyPM25Summary(
                    fips=fips,
                    year=year,
                    avg_total=row.avg_total,
                    avg_fire=row.avg_fire,
                    avg_nonfire=row.avg_nonfire,
                    max_total=row.max_total,
                    max_fire=row.max_fire,
                    max_nonfire=row.max_nonfire,
                    days_count=row.days_count,
                    pop_weighted_total=pop_weighted_total,
                    pop_weighted_fire=pop_weighted_fire,
                    pop_weighted_nonfire=pop_weighted_nonfire
                ))
            self.db.bulk_save_objects(yearly_summaries)
            self.db.commit()

            # MONTHLY AGGREGATIONS
            logger.info("Processing monthly aggregations...")
            monthly_results = self.db.execute(text("""
                SELECT 
                    fips,
                    EXTRACT(year FROM date) as year,
                    EXTRACT(month FROM date) as month,
                    AVG(total) as avg_total,
                    AVG(fire) as avg_fire,
                    AVG(nonfire) as avg_nonfire,
                    MAX(total) as max_total,
                    MAX(fire) as max_fire,
                    MAX(nonfire) as max_nonfire,
                    COUNT(*) as days_count
                FROM daily_pm25
                GROUP BY fips, EXTRACT(year FROM date), EXTRACT(month FROM date)
            """)).fetchall()
            monthly_summaries = []
            for row in monthly_results:
                fips = row.fips
                year = int(row.year)
                month = int(row.month)
                population = pop_lookup.get((fips, year), 0)
                pop_weighted_total = (row.avg_total or 0) * population if population else 0
                pop_weighted_fire = (row.avg_fire or 0) * population if population else 0
                pop_weighted_nonfire = (row.avg_nonfire or 0) * population if population else 0
                monthly_summaries.append(MonthlyPM25Summary(
                    fips=fips,
                    year=year,
                    month=month,
                    avg_total=row.avg_total,
                    avg_fire=row.avg_fire,
                    avg_nonfire=row.avg_nonfire,
                    max_total=row.max_total,
                    max_fire=row.max_fire,
                    max_nonfire=row.max_nonfire,
                    days_count=row.days_count,
                    pop_weighted_total=pop_weighted_total,
                    pop_weighted_fire=pop_weighted_fire,
                    pop_weighted_nonfire=pop_weighted_nonfire
                ))
            self.db.bulk_save_objects(monthly_summaries)
            self.db.commit()

            # SEASONAL AGGREGATIONS
            logger.info("Processing seasonal aggregations...")
            seasonal_results = self.db.execute(text("""
                SELECT 
                    fips,
                    EXTRACT(year FROM date) as year,
                    CASE 
                        WHEN EXTRACT(month FROM date) IN (12, 1, 2) THEN 'winter'
                        WHEN EXTRACT(month FROM date) IN (3, 4, 5) THEN 'spring'
                        WHEN EXTRACT(month FROM date) IN (6, 7, 8) THEN 'summer'
                        ELSE 'fall'
                    END as season,
                    AVG(total) as avg_total,
                    AVG(fire) as avg_fire,
                    AVG(nonfire) as avg_nonfire,
                    MAX(total) as max_total,
                    MAX(fire) as max_fire,
                    MAX(nonfire) as max_nonfire,
                    COUNT(*) as days_count
                FROM daily_pm25
                GROUP BY fips, EXTRACT(year FROM date), 
                    CASE 
                        WHEN EXTRACT(month FROM date) IN (12, 1, 2) THEN 'winter'
                        WHEN EXTRACT(month FROM date) IN (3, 4, 5) THEN 'spring'
                        WHEN EXTRACT(month FROM date) IN (6, 7, 8) THEN 'summer'
                        ELSE 'fall'
                    END
            """)).fetchall()
            seasonal_summaries = []
            for row in seasonal_results:
                fips = row.fips
                year = int(row.year)
                season = row.season
                population = pop_lookup.get((fips, year), 0)
                pop_weighted_total = (row.avg_total or 0) * population if population else 0
                pop_weighted_fire = (row.avg_fire or 0) * population if population else 0
                pop_weighted_nonfire = (row.avg_nonfire or 0) * population if population else 0
                seasonal_summaries.append(SeasonalPM25Summary(
                    fips=fips,
                    year=year,
                    season=season,
                    avg_total=row.avg_total,
                    avg_fire=row.avg_fire,
                    avg_nonfire=row.avg_nonfire,
                    max_total=row.max_total,
                    max_fire=row.max_fire,
                    max_nonfire=row.max_nonfire,
                    days_count=row.days_count,
                    pop_weighted_total=pop_weighted_total,
                    pop_weighted_fire=pop_weighted_fire,
                    pop_weighted_nonfire=pop_weighted_nonfire
                ))
            self.db.bulk_save_objects(seasonal_summaries)
            self.db.commit()

            logger.info("All aggregations processed successfully!")
        except Exception as e:
            logger.error(f"Error during aggregation preprocessing: {e}")
            self.db.rollback()
            raise

    def validate_data(self):
        """Validate loaded data"""
        logger.info("Validating loaded data...")
        
        try:
            # Count records in each table
            county_count = self.db.query(County).count()
            pm25_count = self.db.query(DailyPM25).count()
            population_count = self.db.query(Population).count()
            yearly_count = self.db.query(YearlyPM25Summary).count()
            monthly_count = self.db.query(MonthlyPM25Summary).count()
            seasonal_count = self.db.query(SeasonalPM25Summary).count()
            
            logger.info(f"Data validation results:")
            logger.info(f"  Counties: {county_count:,}")
            logger.info(f"  Daily PM2.5 records: {pm25_count:,}")
            logger.info(f"  Population records: {population_count:,}")
            logger.info(f"  Yearly summaries: {yearly_count:,}")
            logger.info(f"  Monthly summaries: {monthly_count:,}")
            logger.info(f"  Seasonal summaries: {seasonal_count:,}")
            
            # Check for data quality issues
            null_dates = self.db.query(DailyPM25).filter(DailyPM25.date.is_(None)).count()
            negative_pm25 = self.db.query(DailyPM25).filter(DailyPM25.total < 0).count()
            
            if null_dates > 0:
                logger.warning(f"Found {null_dates} records with null dates")
            if negative_pm25 > 0:
                logger.warning(f"Found {negative_pm25} records with negative PM2.5 values")
                
            logger.info("Data validation completed")
            
        except Exception as e:
            logger.error(f"Error during data validation: {e}")
            raise

def main():
    """Main function to load all data"""
    logger.info("=== Starting Data Loading Process ===")
    
    try:
        with DataLoader() as loader:
            # Step 1: Create tables
            loader.create_tables()
            
            # Step 2: Load counties
            loader.load_counties()
            
            # Step 3: Load population data
            loader.load_population_data()
            
            # Step 4: Load PM2.5 data (this will take the longest)
            loader.load_pm25_data()
            
            # Step 5: Create indexes
            loader.create_indexes()
            
            # Step 6: Generate aggregations
            loader.preprocess_aggregations()
            
            # Step 7: Validate data
            loader.validate_data()
            
        logger.info("=== Data Loading Process Completed Successfully ===")
        
    except Exception as e:
        logger.error(f"Data loading failed: {e}")
        raise

if __name__ == "__main__":
    main()