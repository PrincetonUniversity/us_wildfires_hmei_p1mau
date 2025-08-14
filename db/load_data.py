import json
import logging
import math
import os
import sys
import time
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path
from typing import Optional

import geopandas as gpd
import numpy as np
import pandas as pd
from census import Census
from sqlalchemy import func, text
from sqlalchemy.orm import Session, load_only
from us import states

# Import models and database
from .models import (
    Base, County, DailyPM25, Population,
    YearlyPM25Summary, MonthlyPM25Summary, SeasonalPM25Summary,
    BaselineMortalityRate, ExcessMortalitySummary, ExceedanceSummary,
    DecompositionSummary, FireAttributionBin
)
from .database import engine, SessionLocal

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
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

    def clear_table(self, table_name):
        """Drop the given table"""
        logger.info(f"Dropping table: {table_name}")
        self.db.execute(f"DROP TABLE IF EXISTS {table_name}")
        self.db.commit()

    def load_shapefiles(self, shapefile_path: Optional[str] = None):
        """Load county geometries from shapefile"""
        if shapefile_path is None:
            shapefile_path = "data/shapefiles/county/cb_2024_us_county_5m.shp"

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
                    geojson = json.loads(
                        gpd.GeoSeries([row.geometry]).to_json())
                    geometry_dict = geojson['features'][0]['geometry']

                    # Update county with geometry
                    county = self.db.query(County).filter(
                        County.fips == row['FIPS']).first()
                    if county:
                        county.geometry = geometry_dict
                        updated_count += 1
                    else:
                        logger.warning(
                            f"County with FIPS {row['FIPS']} not found in database")

                except Exception as e:
                    logger.warning(
                        f"Error processing geometry for FIPS {row['FIPS']}: {e}")
                    continue

                # Commit every 100 updates
                if updated_count % 100 == 0:
                    self.db.commit()
                    logger.info(
                        f"Updated {updated_count} county geometries...")

            # Final commit
            self.db.commit()
            logger.info(
                f"Successfully updated {updated_count} counties with geometries")

        except Exception as e:
            logger.error(f"Error loading shapefiles: {e}")
            self.db.rollback()
            raise

    def load_counties(self, fips_filepath: Optional[str] = None, shapefile_path: Optional[str] = None):
        """Load county data from FIPScode.csv and geometries from shapefile"""
        if fips_filepath is None:
            fips_filepath = self.data_dir / "FIPScode.csv"
        if shapefile_path is None:
            shapefile_path = "data/shapefiles/county/cb_2024_us_county_5m.shp"

        logger.info(f"Loading counties from {fips_filepath}")

        try:
            # Clear existing table
            logger.info("Clearing existing counties table...")
            self.db.query(County).delete()
            self.db.commit()

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
                        geojson = json.loads(
                            gpd.GeoSeries([row.geometry]).to_json())
                        geometry_lookup[row['FIPS']
                                        ] = geojson['features'][0]['geometry']
                    except:
                        continue

                logger.info(
                    f"Loaded {len(geometry_lookup)} geometries from shapefile")

            logger.info(f"Found {len(df)} counties to load")

            # Batch insert counties with geometries
            counties_to_insert = []
            for idx, row in df.iterrows():
                geometry = geometry_lookup.get(
                    row['FIPS']) if 'geometry_lookup' in locals() else None

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
            counties_with_geom = sum(
                1 for c in counties_to_insert if c.geometry is not None)
            logger.info(
                f"Successfully loaded {len(df)} counties ({counties_with_geom} with geometries)")

        except Exception as e:
            logger.error(f"Error loading counties: {e}")
            self.db.rollback()
            raise

    def load_population_data(self, filepath: Optional[str] = None):
        """Load population data from population_2006_2023.csv (filtered for years 2006-2008)"""
        if filepath is None:
            filepath = self.data_dir / "population_2006_2023.csv"

        logger.info(
            f"Loading population data from {filepath} (years 2006-2008 only)")

        try:
            # Clear existing table
            logger.info("Clearing existing population table...")
            self.db.query(Population).delete()
            self.db.commit()

            df = pd.read_csv(filepath, dtype={
                             "fips": str, "year": int, "age_group": int, "population": int})
            df.columns = df.columns.str.strip().str.replace('"', '')

            # Filter for years 2006-2008 only
            df = df[df['year'].isin([2006, 2007, 2008])]
            logger.info(f"Filtered data to {len(df)} rows for years 2006-2008")
            logger.info(
                f"Years in filtered data: {sorted(df['year'].unique())}")

            # Get set of valid FIPS codes from County table
            counties = {c.fips for c in self.db.query(County.fips).all()}

            population_data = []
            processed_count = 0
            matched_count = 0
            # For total pop by (fips, year)
            total_pop_by_county_year = defaultdict(int)

            for _, row in df.iterrows():
                processed_count += 1
                try:
                    fips = str(row['fips']).zfill(5)
                    year = int(row['year'])
                    age_group = int(row['age_group'])
                    population = int(row['population']) if pd.notna(
                        row['population']) else 0
                    if fips not in counties:
                        logger.warning(
                            f"Skipped county FIPS {fips} (not found in DB) for year {year}")
                        continue
                    pop_record = Population(
                        fips=fips,
                        year=year,
                        age_group=age_group,
                        population=population
                    )
                    population_data.append(pop_record)
                    total_pop_by_county_year[(fips, year)] += population
                    matched_count += 1
                    if len(population_data) >= 1000:
                        self.db.bulk_save_objects(population_data)
                        self.db.commit()
                        logger.info(
                            f"Inserted batch of {len(population_data)} population records...")
                        population_data = []
                except Exception as e:
                    logger.warning(
                        f"Error processing row {processed_count}: {e}")
                    logger.warning(f"Row data: {dict(row)}")
                    continue

            # Insert any remaining age-grouped records
            if population_data:
                self.db.bulk_save_objects(population_data)
                self.db.commit()
                logger.info(
                    f"Inserted final batch of {len(population_data)} population records")

            # Now insert total population (age_group=0) for each (fips, year)
            total_records = []
            for (fips, year), total_pop in total_pop_by_county_year.items():
                total_record = Population(
                    fips=fips,
                    year=year,
                    age_group=0,
                    population=total_pop
                )
                total_records.append(total_record)
                if len(total_records) >= 1000:
                    self.db.bulk_save_objects(total_records)
                    self.db.commit()
                    logger.info(
                        f"Inserted batch of {len(total_records)} total population records...")
                    total_records = []
            if total_records:
                self.db.bulk_save_objects(total_records)
                self.db.commit()
                logger.info(
                    f"Inserted final batch of {len(total_records)} total population records (age_group=0)")

            logger.info(f"Population loading summary (years 2006-2008):")
            logger.info(f"  Total rows processed: {processed_count}")
            logger.info(f"  Successfully matched: {matched_count}")
            logger.info(f"  Records inserted: {matched_count}")

            total_in_db = self.db.query(Population).count()
            logger.info(f"Total population records in database: {total_in_db}")

        except Exception as e:
            logger.error(f"Error loading population data: {e}")
            self.db.rollback()
            raise

    def load_population_data_api(self):
        """Load population data for all US counties (2009–2023) by age group using Census API (ACS 5-year, table B01001)"""
        api_key = os.getenv("CENSUS_API_KEY")
        if not api_key:
            logger.error("CENSUS_API_KEY is not set.")
            return
        c = Census(api_key)
        years = range(2009, 2024)

        # Age group mapping: group index -> [male_var, female_var, ...]
        ACS_AGE_VARIABLES = {
            # 0–4 years
            1:  ['B01001_003E', 'B01001_027E'],
            # 5–9 years
            2:  ['B01001_004E', 'B01001_028E'],
            # 10–14 years
            3:  ['B01001_005E', 'B01001_029E'],
            # 15–19 years
            4:  ['B01001_006E', 'B01001_007E', 'B01001_030E', 'B01001_031E'],
            5:  ['B01001_008E', 'B01001_009E', 'B01001_010E',
                 'B01001_032E', 'B01001_033E', 'B01001_034E'],                 # 20–24 years
            # 25–29 years
            6:  ['B01001_011E', 'B01001_035E'],
            # 30–34 years
            7:  ['B01001_012E', 'B01001_036E'],
            # 35–39 years
            8:  ['B01001_013E', 'B01001_037E'],
            # 40–44 years
            9:  ['B01001_014E', 'B01001_038E'],
            # 45–49 years
            10: ['B01001_015E', 'B01001_039E'],
            # 50–54 years
            11: ['B01001_016E', 'B01001_040E'],
            # 55–59 years
            12: ['B01001_017E', 'B01001_041E'],
            # 60–64 years
            13: ['B01001_018E', 'B01001_019E', 'B01001_042E', 'B01001_043E'],
            # 65–69 years
            14: ['B01001_020E', 'B01001_021E', 'B01001_044E', 'B01001_045E'],
            # 70–74 years
            15: ['B01001_022E', 'B01001_046E'],
            # 75–79 years
            16: ['B01001_023E', 'B01001_047E'],
            # 80–84 years
            17: ['B01001_024E', 'B01001_048E'],
            # 85+ years
            18: ['B01001_025E', 'B01001_049E'],
        }

        def sum_age_group(row, var_list):
            total = 0
            for var in var_list:
                val = row.get(var)
                try:
                    total += int(val) if val is not None else 0
                except (ValueError, TypeError):
                    logger.warning(f"Non-integer value for {var}: {val}")
            return total

        counties = {c.fips for c in self.db.query(County.fips).all()}
        population_data = []
        processed_count = 0
        matched_count = 0
        county_counter = 0

        logger.info(
            "Loading population data from Census API (ACS 5-year, B01001)...")
        try:
            for year in years:
                logger.info(f"Loading population data for year {year}")
                for state in states.STATES:
                    try:
                        all_vars = [v for sublist in ACS_AGE_VARIABLES.values()
                                    for v in sublist] + ['B01001_001E']
                        result = c.acs5.get(
                            all_vars + ['NAME'], geo={'for': 'county:*', 'in': f'state:{state.fips}'}, year=year)
                        for row in result:
                            fips = row['state'] + row['county']
                            processed_count += 1
                            if fips not in counties:
                                logger.debug(
                                    f"Skipped county FIPS {fips} (not found in DB) for year {year}")
                                continue

                            # Skip Connecticut counties for 2022-2023 (will be handled manually)
                            if fips.startswith('09') and year in [2022, 2023]:
                                logger.debug(
                                    f"Skipping Connecticut county {fips} for year {year} (will be handled manually)")
                                continue

                            # Normal processing for all counties/years
                            county_counter += 1

                            # Add age group populations
                            for group_index, var_list in ACS_AGE_VARIABLES.items():
                                total = sum_age_group(row, var_list)
                                try:
                                    population_data.append(Population(
                                        fips=fips,
                                        year=year,
                                        age_group=group_index,
                                        population=total
                                    ))
                                    matched_count += 1
                                except Exception as e:
                                    logger.warning(
                                        f"Error creating Population record for {fips}, {year}, group {group_index}: {e}")

                            # Add total population as age_group=0 (only once per county-year)
                            try:
                                total_pop = int(row.get('B01001_001E', 0))
                                population_data.append(Population(
                                    fips=fips,
                                    year=year,
                                    age_group=0,  # Special index for total population
                                    population=total_pop
                                ))
                                matched_count += 1
                            except Exception as e:
                                logger.warning(
                                    f"Error creating total Population record for {fips}, {year}: {e}")
                            # Commit after every 100 counties
                            if county_counter % 100 == 0:
                                self.db.bulk_save_objects(population_data)
                                self.db.commit()
                                logger.info(
                                    f"Inserted batch of {len(population_data)} population records after {county_counter} counties...")
                                population_data = []
                    except Exception as e:
                        logger.warning(
                            f"Error fetching data for {state.name}, {year}: {e}")
                        continue
            # Insert any remaining records
            if population_data:
                self.db.bulk_save_objects(population_data)
                self.db.commit()
                logger.info(
                    f"Inserted final batch of {len(population_data)} population records")

            # Manually insert Connecticut population data for 2022-2023
            logger.info(
                "Inserting Connecticut population data for 2022-2023...")

            # First, get the actual 2021 Connecticut age group distribution from the database
            ct_2021_distribution = {}
            ct_counties = ['09001', '09003', '09005',
                           '09007', '09009', '09011', '09013', '09015']

            # Get 2021 data for Connecticut counties to calculate distribution
            for fips in ct_counties:
                ct_2021_data = self.db.query(Population).filter(
                    Population.fips == fips,
                    Population.year == 2021,
                    # Exclude total population (age_group=0)
                    Population.age_group > 0
                ).all()

                if ct_2021_data:
                    # Calculate distribution from actual 2021 data
                    total_2021_pop = sum(
                        record.population for record in ct_2021_data)
                    if total_2021_pop > 0:
                        for record in ct_2021_data:
                            if record.age_group not in ct_2021_distribution:
                                ct_2021_distribution[record.age_group] = 0
                            ct_2021_distribution[record.age_group] += record.population

            # Normalize the distribution to percentages
            if ct_2021_distribution:
                total_ct_2021 = sum(ct_2021_distribution.values())
                ct_2021_distribution = {age_group: count / total_ct_2021
                                        for age_group, count in ct_2021_distribution.items()}
                logger.info(
                    f"Using actual 2021 Connecticut age group distribution: {ct_2021_distribution}")
            else:
                # Fallback to realistic distribution if no 2021 data found
                logger.warning(
                    "No 2021 Connecticut data found, using realistic US distribution")
                ct_2021_distribution = {
                    1: 0.061,   # 0-4 years: 6.1%
                    2: 0.062,   # 5-9 years: 6.2%
                    3: 0.063,   # 10-14 years: 6.3%
                    4: 0.065,   # 15-19 years: 6.5%
                    5: 0.066,   # 20-24 years: 6.6%
                    6: 0.065,   # 25-29 years: 6.5%
                    7: 0.064,   # 30-34 years: 6.4%
                    8: 0.063,   # 35-39 years: 6.3%
                    9: 0.062,   # 40-44 years: 6.2%
                    10: 0.061,  # 45-49 years: 6.1%
                    11: 0.060,  # 50-54 years: 6.0%
                    12: 0.059,  # 55-59 years: 5.9%
                    13: 0.058,  # 60-64 years: 5.8%
                    14: 0.055,  # 65-69 years: 5.5%
                    15: 0.050,  # 70-74 years: 5.0%
                    16: 0.040,  # 75-79 years: 4.0%
                    17: 0.030,  # 80-84 years: 3.0%
                    18: 0.025   # 85+ years: 2.5%
                }

            ct_population_2022_2023 = {
                '09001': {'name': 'Fairfield County', '2022': 848952, '2023': 846762},
                '09003': {'name': 'Hartford County', '2022': 837292, '2023': 830321},
                '09005': {'name': 'Litchfield County', '2022': 294306, '2023': 293386},
                '09007': {'name': 'Middlesex County', '2022': 157653, '2023': 157018},
                '09009': {'name': 'New Haven County', '2022': 851116, '2023': 848712},
                '09011': {'name': 'New London County', '2022': 371197, '2023': 370193},
                '09013': {'name': 'Tolland County', '2022': 139872, '2023': 138707},
                '09015': {'name': 'Windham County', '2022': 113412, '2023': 113246}
            }

            ct_population_records = []
            for fips, data in ct_population_2022_2023.items():
                for year in [2022, 2023]:
                    population_value = int(data[str(year)])
                    # Insert total population (age_group=0)
                    ct_population_records.append(Population(
                        fips=fips,
                        year=year,
                        age_group=0,
                        population=population_value
                    ))
                    # Insert age group populations (using proportional distribution from 2021)
                    # Realistic 2021 age group distribution based on US demographics
                    # Age group percentages based on typical US population pyramid
                    age_group_distribution = ct_2021_distribution

                    for age_group in range(1, 19):
                        # Calculate population for this age group using realistic distribution
                        age_group_population = int(
                            population_value * age_group_distribution[age_group])
                        ct_population_records.append(Population(
                            fips=fips,
                            year=year,
                            age_group=age_group,
                            population=age_group_population
                        ))

            if ct_population_records:
                self.db.bulk_save_objects(ct_population_records)
                self.db.commit()
                logger.info(
                    f"Inserted {len(ct_population_records)} Connecticut population records for 2022-2023")

            logger.info("Population data loaded from Census API.")
            logger.info(
                f"  Total county-year rows processed: {processed_count}")
            logger.info(f"  Population records inserted: {matched_count}")
            # Verify insertion: 19 records per county per year (18 age groups + 1 total)
            total_in_db = self.db.query(Population).count()
            logger.info(f"Total population records in database: {total_in_db}")
        except Exception as e:
            logger.exception(
                f"Error loading population data from Census API: {e}")
            self.db.rollback()
            raise

    def load_pm25_data(self, filepath: Optional[str] = None, chunk_size: int = 10000):
        """Load PM2.5 data from daily_county_data_combined.csv"""
        if filepath is None:
            filepath = self.data_dir / "daily_county_data_combined_2006.csv"

        logger.info(f"Loading PM2.5 data from {filepath}")

        try:
            logger.info("Clearing existing PM2.5 table...")
            self.db.query(DailyPM25).delete()
            self.db.commit()
            # Read CSV in chunks to handle large file
            total_records = 0
            chunk_count = 0

            for chunk in pd.read_csv(filepath, chunksize=chunk_size, dtype={'FIPS': str}):
                chunk_count += 1
                logger.info(
                    f"Processing chunk {chunk_count} ({len(chunk)} records)")

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
                chunk['nonfire_pm25'] = chunk['total_value'] - \
                    chunk['fire_pm25']
                chunk['nonfire_pm25'] = chunk['nonfire_pm25'].clip(
                    lower=0)  # Ensure non-negative

                # Prepare PM2.5 records
                pm25_records = []
                for _, row in chunk.iterrows():
                    try:
                        pm25_record = DailyPM25(
                            fips=row['FIPS'],
                            county_index=int(row['county_index']),
                            date=row['date'].date(),
                            total=float(row['total_value']) if pd.notna(
                                row['total_value']) else 0.0,
                            fire=float(row['fire_pm25']) if pd.notna(
                                row['fire_pm25']) else 0.0,
                            nonfire=float(row['nonfire_pm25']) if pd.notna(
                                row['nonfire_pm25']) else 0.0
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
                    logger.info(
                        f"Inserted {len(pm25_records)} PM2.5 records (Total: {total_records})")

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
                logger.info(
                    f"Created index: {index_sql.split('ON')[1].split('(')[0].strip()}")
            except Exception as e:
                logger.warning(
                    f"Index creation failed (may already exist): {e}")

    def load_baseline_mortality(self, filepath: Optional[str] = None):
        """Load baseline mortality rates from all_basemor_results.csv"""
        if filepath is None:
            filepath = self.data_dir / "all_basemor_results.csv"
        logger.info(f"Loading baseline mortality rates from {filepath}")

        try:
            # Clear existing table
            logger.info("Clearing existing table...")
            self.db.query(BaselineMortalityRate).delete()
            self.db.commit()

            df = pd.read_csv(filepath)
            # Clean column names
            df.columns = df.columns.str.strip().str.replace('"', '')

            # Build county index -> FIPS mapping
            county_mapping = {c.index: c.fips for c in self.db.query(
                County.index, County.fips).all()}

            records = []
            for _, row in df.iterrows():
                county_index = int(row['county'])
                fips = county_mapping.get(county_index)
                if not fips:
                    logger.warning(
                        f"County index {county_index} not found in counties table, skipping.")
                    continue
                record = BaselineMortalityRate(
                    fips=fips,
                    county_index=county_index,
                    year=(int(row['year']) + 1999),
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
                    logger.info(
                        f"Inserted {len(records)} baseline mortality records...")
                    records = []
            if records:
                self.db.bulk_save_objects(records)
                self.db.commit()
                logger.info(
                    f"Inserted final {len(records)} baseline mortality records.")
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
                pop_weighted_total = (row.avg_total or 0) * \
                    population if population else 0
                pop_weighted_fire = (row.avg_fire or 0) * \
                    population if population else 0
                pop_weighted_nonfire = (
                    row.avg_nonfire or 0) * population if population else 0
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
                pop_weighted_total = (row.avg_total or 0) * \
                    population if population else 0
                pop_weighted_fire = (row.avg_fire or 0) * \
                    population if population else 0
                pop_weighted_nonfire = (
                    row.avg_nonfire or 0) * population if population else 0
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
                pop_weighted_total = (row.avg_total or 0) * \
                    population if population else 0
                pop_weighted_fire = (row.avg_fire or 0) * \
                    population if population else 0
                pop_weighted_nonfire = (
                    row.avg_nonfire or 0) * population if population else 0
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

    def excess_mortality_summary(self, default_method="gemm"):
        """Compute and store total, fire, and nonfire excess mortality for each county-year-age_group using all methods.
        OPTIMIZED VERSION with reduced batch size and better data structures.
        default_method: which method to use for the legacy total_excess/fire_excess/nonfire_excess columns"""

        logger.info(
            f"Computing excess mortality summary for all counties/years/age_groups using all methods...")

        BATCH_SIZE = 1000

        # GEMM parameters (Burnett et al. 2018, NCD+LRI)
        theta_age = {
            1:  0.1430,  # 0-4 years (est)
            2:  0.1430,  # 5-9 years (est)
            3:  0.1430,  # 10-14 years (est)
            4:  0.1430,  # 15-19 years (est)
            5:  0.1430,  # 20-24 years
            6:  0.1585,  # 25-29 years
            7:  0.1577,  # 30-34 years
            8:  0.1570,  # 35-39 years
            9:  0.1558,  # 40-44 years
            10: 0.1532,  # 45-49 years
            11: 0.1499,  # 50-54 years
            12: 0.1462,  # 55-59 years
            13: 0.1421,  # 60-64 years
            14: 0.1374,  # 65-69 years
            15: 0.1319,  # 70-74 years
            16: 0.1253,  # 75-79 years
            17: 0.1141,  # 80-84 years (est)
            18: 0.1141,  # 85+ years
        }
        alpha = 1.6
        mu = 15.5
        nu = 36.8

        # Pre-calculate omega cache for common z values
        omega_cache = {}
        for z_int in range(201):  # 0-200 μg/m³
            z = float(z_int)
            omega_cache[z] = 1 / (1 + np.exp(-(z - mu) / nu))

        def omega(z):
            z_rounded = round(z)
            if z_rounded in omega_cache:
                return omega_cache[z_rounded]
            return 1 / (1 + np.exp(-(z - mu) / nu))

        def HR(z, age_group):
            return np.exp(theta_age[age_group] * np.log(1 + z / alpha) * omega(z))

        # Life Expectancy Lookup Table for YLL calculation
        LE_LOOKUP = {
            1: 75.8, 2: 71.0, 3: 66.0, 4: 61.1, 5: 56.4, 6: 51.7,
            7: 47.1, 8: 42.5, 9: 38.0, 10: 33.6, 11: 29.2, 12: 25.1,
            13: 21.2, 14: 17.5, 15: 14.0, 16: 10.7, 17: 7.9, 18: 3.9
        }

        def map_age_group_for_af(age_group):
            if 1 <= age_group <= 13:
                return "0 to 64"
            elif 14 <= age_group <= 18:
                return "65 above"
            else:
                return None

        def map_age_group_for_hr(age_group):
            if 1 <= age_group <= 13:
                return "under_65"
            elif 14 <= age_group <= 18:
                return "65_and_up"
            else:
                return None

        # Efficient preloading with load_only
        logger.info("Preloading yearly PM2.5 summaries...")
        yearly_map = {}
        for y in self.db.query(YearlyPM25Summary).options(
            load_only(YearlyPM25Summary.fips, YearlyPM25Summary.year,
                      YearlyPM25Summary.avg_total, YearlyPM25Summary.avg_fire,
                      YearlyPM25Summary.avg_nonfire)
        ).all():
            yearly_map[(y.fips, y.year)] = y

        logger.info(f"Loaded {len(yearly_map):,} PM2.5 summary records")

        # More efficient population preloading
        logger.info("Preloading population data...")
        pop_map = defaultdict(dict)
        for row in self.db.query(Population).filter(
            Population.age_group != 0
        ).options(load_only(Population.fips, Population.year,
                            Population.age_group, Population.population)):
            pop_map[(row.fips, row.year)][row.age_group] = row.population

        # Convert to regular dict to save memory
        pop_map = dict(pop_map)
        logger.info(
            f"Loaded population data for {len(pop_map):,} county-year combinations")

        # Efficient baseline mortality preloading
        logger.info("Preloading baseline mortality rates...")
        basemor_map = {}
        baseline_query = self.db.query(BaselineMortalityRate).filter(
            BaselineMortalityRate.source == 'basemor_ALL',
            BaselineMortalityRate.stat_type == '1',
            BaselineMortalityRate.allage_flag == False
        ).options(load_only(BaselineMortalityRate.fips, BaselineMortalityRate.year,
                            BaselineMortalityRate.age_group, BaselineMortalityRate.value))

        for row in baseline_query:
            basemor_map[(row.fips, row.year, row.age_group)] = row.value

        logger.info(f"Loaded {len(basemor_map):,} baseline mortality records")

        # Efficient bootstrap data structure
        logger.info("Building optimized bootstrap lookup...")
        bootstrap_lookup = defaultdict(lambda: defaultdict(dict))

        bootstrap_query = self.db.query(FireAttributionBin).filter(
            FireAttributionBin.method == "bootstrapped_bin_hr"
        ).options(load_only(FireAttributionBin.age_group, FireAttributionBin.bin_lower,
                            FireAttributionBin.bin_upper, FireAttributionBin.bootid,
                            FireAttributionBin.coef))

        bootstrap_count = 0
        for row in bootstrap_query:
            if row.coef is not None:
                bin_key = (row.bin_lower, row.bin_upper)
                bootstrap_lookup[row.age_group][bin_key][row.bootid] = row.coef
                bootstrap_count += 1

        # Convert to regular dicts to save memory
        bootstrap_lookup = {
            age_group: {
                bin_key: dict(bootid_dict)
                for bin_key, bootid_dict in bins.items()
            }
            for age_group, bins in bootstrap_lookup.items()
        }

        logger.info(f"Loaded {bootstrap_count:,} bootstrap coefficients")

        # Efficient precomputed lookup
        logger.info("Building optimized precomputed AF lookup...")
        precomputed_lookup = defaultdict(dict)
        precomputed_query = self.db.query(FireAttributionBin).filter(
            FireAttributionBin.method == "precomputed_bin_af",
            FireAttributionBin.cause == "Nonaccidental"
        ).options(load_only(FireAttributionBin.age_group, FireAttributionBin.bin_lower,
                            FireAttributionBin.bin_upper, FireAttributionBin.af))

        precomputed_count = 0
        for row in precomputed_query:
            if row.af is not None:
                bin_key = (row.bin_lower, row.bin_upper)
                precomputed_lookup[row.age_group][bin_key] = row.af
                precomputed_count += 1

        precomputed_lookup = dict(precomputed_lookup)
        logger.info(f"Loaded {precomputed_count:,} precomputed AF values")

        # Clear existing data
        self.db.query(ExcessMortalitySummary).delete()
        logger.info("Cleared excess mortality summary table...")
        to_insert = []

        logger.info("Starting excess mortality computation...")
        processed_records = 0
        batch_count = 0

        for (fips, year), age_dict in pop_map.items():
            yearly = yearly_map.get((fips, year))
            if not yearly:
                continue

            pm25 = yearly.avg_total
            pm25_fire = yearly.avg_fire
            pm25_nonfire = yearly.avg_nonfire

            z = max(0, pm25 - 2.4)
            z_nonfire = max(0, pm25_nonfire - 2.4)

            for age_group, pop in age_dict.items():
                y0 = basemor_map.get((fips, year, age_group), 0)
                if pop is None or y0 is None or pop == 0 or y0 == 0:
                    continue

                # Initialize all method results
                results = {}

                # === GEMM METHOD ===
                if age_group < 6:
                    hr_total = 1
                    hr_nonfire = 1
                else:
                    hr_total = HR(z, age_group)
                    hr_nonfire = HR(z_nonfire, age_group)

                total_gemm = pop * y0 * \
                    (1 - 1/hr_total) if np.isfinite(hr_total) and hr_total != 0 else 0.0
                nonfire_gemm = pop * y0 * \
                    (1 - 1/hr_nonfire) if np.isfinite(hr_nonfire) and hr_nonfire != 0 else 0.0
                fire_gemm = total_gemm - nonfire_gemm

                results['gemm'] = {
                    'total': total_gemm,
                    'fire': fire_gemm,
                    'nonfire': nonfire_gemm
                }

                # === BOOTSTRAPPED METHOD, QIU ===
                hr_age_group = map_age_group_for_hr(age_group)
                fire_boot_values = []

                if hr_age_group is None or hr_age_group not in bootstrap_lookup:
                    fire_boot = 0.0
                else:
                    # Find matching bin
                    matching_bin = None
                    for bin_key in bootstrap_lookup[hr_age_group]:
                        bl, bu = bin_key
                        if bl <= pm25_fire < bu:
                            matching_bin = bin_key
                            break

                    if matching_bin is None:
                        fire_boot = 0.0
                    else:
                        bootid_dict = bootstrap_lookup[hr_age_group][matching_bin]

                        # Use ALL 500 bootstrap replicates
                        for bootid in range(1, 501):
                            coef = bootid_dict.get(bootid)
                            if coef is None:
                                fire_boot_values.append(0.0)
                            else:
                                rr = math.exp(coef)
                                af = (rr - 1) / rr
                                fire_boot_values.append(pop * y0 * af)

                        fire_boot = sum(
                            fire_boot_values) / len(fire_boot_values) if fire_boot_values else 0.0

                total_boot = fire_boot + nonfire_gemm

                results['boot'] = {
                    'total': total_boot,
                    'fire': fire_boot,
                    'nonfire': nonfire_gemm
                }

                # === PRECOMPUTED METHOD, MA ===
                af_age_group = map_age_group_for_af(age_group)
                if af_age_group is None or af_age_group not in precomputed_lookup:
                    fire_prec = 0.0
                else:
                    # Find matching AF bin
                    af_value = None
                    for bin_key, af in precomputed_lookup[af_age_group].items():
                        bl, bu = bin_key
                        if bl <= pm25_fire < bu:
                            af_value = af
                            break

                    if af_value is None:
                        fire_prec = 0.0
                    else:
                        fire_prec = pop * y0 * af_value

                total_prec = fire_prec + nonfire_gemm

                results['prec'] = {
                    'total': total_prec,
                    'fire': fire_prec,
                    'nonfire': nonfire_gemm
                }

                # Get life expectancy
                le = LE_LOOKUP.get(age_group, 0)

                # Set legacy columns based on default method
                default_results = results[default_method]

                to_insert.append(ExcessMortalitySummary(
                    fips=fips,
                    year=year,
                    age_group=age_group,
                    population=pop,

                    # Legacy columns (for backward compatibility)
                    total_excess=default_results['total'],
                    fire_excess=default_results['fire'],
                    nonfire_excess=default_results['nonfire'],
                    yll_total=default_results['total'] * le,
                    yll_fire=default_results['fire'] * le,
                    yll_nonfire=default_results['nonfire'] * le,

                    # Method-specific columns
                    total_gemm=results['gemm']['total'],
                    fire_gemm=results['gemm']['fire'],
                    nonfire_gemm=results['gemm']['nonfire'],
                    yll_total_gemm=results['gemm']['total'] * le,
                    yll_fire_gemm=results['gemm']['fire'] * le,
                    yll_nonfire_gemm=results['gemm']['nonfire'] * le,

                    total_boot=results['boot']['total'],
                    fire_boot=results['boot']['fire'],
                    yll_total_boot=results['boot']['total'] * le,
                    yll_fire_boot=results['boot']['fire'] * le,

                    total_prec=results['prec']['total'],
                    fire_prec=results['prec']['fire'],
                    yll_total_prec=results['prec']['total'] * le,
                    yll_fire_prec=results['prec']['fire'] * le,
                ))

                processed_records += 1

                # Commit in smaller batches
                if len(to_insert) >= BATCH_SIZE:
                    batch_count += 1
                    batch_start_time = time.time()

                    self.db.bulk_save_objects(to_insert)
                    self.db.commit()

                    batch_time = time.time() - batch_start_time
                    logger.info(f"Batch {batch_count}: Inserted {len(to_insert):,} records in {batch_time:.1f}s "
                                f"(Total processed: {processed_records:,})")
                    to_insert = []

        # Insert remaining records
        if to_insert:
            batch_count += 1
            batch_start_time = time.time()

            self.db.bulk_save_objects(to_insert)
            self.db.commit()

            batch_time = time.time() - batch_start_time
            logger.info(
                f"Final batch {batch_count}: Inserted {len(to_insert):,} records in {batch_time:.1f}s")

        logger.info(f"Excess mortality summary computation complete. "
                    f"Total records processed: {processed_records:,} in {batch_count} batches")

    def switch_default_method(self, new_method="gemm"):
        """Switch which method is used for the legacy total_excess/fire_excess columns.
        new_method: 'gemm', 'boot', or 'prec'"""
        logger.info(f"Switching default method to {new_method}...")

        if new_method == "gemm":
            self.db.execute(text("""
                UPDATE excess_mortality_summary SET
                total_excess = total_gemm,
                fire_excess = fire_gemm,
                nonfire_excess = nonfire_gemm,
                yll_total = yll_total_gemm,
                yll_fire = yll_fire_gemm,
                yll_nonfire = yll_nonfire_gemm
            """))
        elif new_method == "boot":
            self.db.execute(text("""
                UPDATE excess_mortality_summary SET
                total_excess = total_boot,
                fire_excess = fire_boot,
                nonfire_excess = nonfire_gemm,
                yll_total = yll_total_boot,
                yll_fire = yll_fire_boot,
                yll_nonfire = yll_nonfire_gemm
            """))
        elif new_method == "prec":
            self.db.execute(text("""
                UPDATE excess_mortality_summary SET
                total_excess = total_prec,
                fire_excess = fire_prec,
                nonfire_excess = nonfire_gemm,
                yll_total = yll_total_prec,
                yll_fire = yll_fire_prec,
                yll_nonfire = yll_nonfire_gemm
            """))
        else:
            raise ValueError(f"Unknown method: {new_method}")

        self.db.commit()
        logger.info(f"Default method switched to {new_method}")

    def load_exceedance_summary(self, filepath: Optional[str] = None):
        """Load exceedance summary for all counties from county_tier_category.csv into ExceedanceSummary table"""
        if filepath is None:
            filepath = self.data_dir / "county_tier_category.csv"
        logger.info(f"Loading exceedance summary from {filepath}")

        try:
            # Clear existing table
            logger.info("Clearing existing exceedance summary table...")
            self.db.query(ExceedanceSummary).delete()
            self.db.commit()

            # Build FIPS -> county_index mapping
            county_mapping = {c.fips: c.index for c in self.db.query(
                County.fips, County.index).all()}

            df = pd.read_csv(filepath, dtype={"FIPS": str})
            df.columns = df.columns.str.strip().str.replace('"', '')
            logger.info(f"CSV columns: {list(df.columns)}")

            records = []
            processed_count = 0
            matched_count = 0
            for _, row in df.iterrows():
                processed_count += 1
                fips = str(row["FIPS"]).zfill(5)
                county_index = county_mapping.get(fips)
                if not county_index:
                    logger.warning(
                        f"FIPS {fips} not found in counties table, skipping.")
                    continue
                # Handle NA values as None

                def parse_int(val):
                    if pd.isna(val) or val == "NA":
                        return None
                    try:
                        return int(val)
                    except Exception:
                        return None
                threshold_9 = parse_int(row.get("Threshold_9ugm3"))
                threshold_8 = parse_int(row.get("Threshold_8ugm3"))
                record = ExceedanceSummary(
                    fips=fips,
                    county_index=county_index,
                    threshold_9=threshold_9,
                    threshold_8=threshold_8
                )
                records.append(record)
                matched_count += 1
                if len(records) >= 1000:
                    self.db.bulk_save_objects(records)
                    self.db.commit()
                    logger.info(
                        f"Inserted batch of {len(records)} exceedance summary records...")
                    records = []
            if records:
                self.db.bulk_save_objects(records)
                self.db.commit()
                logger.info(
                    f"Inserted final batch of {len(records)} exceedance summary records.")
            logger.info(
                f"Exceedance summary loading complete. Processed: {processed_count}, Inserted: {matched_count}")
        except Exception as e:
            logger.error(f"Error loading exceedance summary: {e}")
            self.db.rollback()
            raise

    def load_decomposition_summary(self, start_year=2006, end_year=2023):
        """
        Compute and store decomposition summary for each county for the given year range.
        Now includes both total and fire PM2.5 decompositions.
        """
        logger = logging.getLogger(__name__)
        logger.info(
            f"Calculating decomposition summary for all counties ({start_year}-{end_year})...")

        self.db.query(DecompositionSummary).delete()
        self.db.commit()

        all_fips = [c.fips for c in self.db.query(County.fips).all()]
        to_insert = []

        # Define GEMM functions to match your corrected method
        def omega(z):
            mu, nu = 15.5, 36.8
            return 1 / (1 + np.exp(-(z - mu) / nu))

        theta_age = {
            1:  0.1430, 2:  0.1430, 3:  0.1430, 4:  0.1430, 5:  0.1430,
            6:  0.1585, 7:  0.1577, 8:  0.1570, 9:  0.1558, 10: 0.1532,
            11: 0.1499, 12: 0.1462, 13: 0.1421, 14: 0.1374, 15: 0.1319,
            16: 0.1253, 17: 0.1141, 18: 0.1141,
        }
        alpha = 1.6

        def HR(z, age_group):
            # Apply age restriction like your corrected method
            if age_group < 6:
                return 1.0
            return np.exp(theta_age[age_group] * np.log(1 + z / alpha) * omega(z))

        def AF(pm25_value, age_group):
            # Subtract 2.4 from PM2.5 like your corrected method
            z = max(0, pm25_value - 2.4)
            hr = HR(z, age_group)
            if not np.isfinite(hr) or hr == 0:
                return 0.0
            return 1 - 1/hr

        for idx, fips in enumerate(all_fips):
            # Load data for both years for this county
            pop_start = {row.age_group: row.population for row in self.db.query(
                Population).filter_by(fips=fips, year=start_year)}
            pop_end = {row.age_group: row.population for row in self.db.query(
                Population).filter_by(fips=fips, year=end_year)}

            # Use proper filter for mortality data
            mort_start = {row.age_group: row.value for row in self.db.query(BaselineMortalityRate).filter(
                BaselineMortalityRate.fips == fips,
                BaselineMortalityRate.year == start_year,
                BaselineMortalityRate.source == 'basemor_ALL',
                BaselineMortalityRate.stat_type == '1',  # Use '1' not 'mean'
                BaselineMortalityRate.allage_flag == False
            )}
            mort_end = {row.age_group: row.value for row in self.db.query(BaselineMortalityRate).filter(
                BaselineMortalityRate.fips == fips,
                BaselineMortalityRate.year == end_year,
                BaselineMortalityRate.source == 'basemor_ALL',
                BaselineMortalityRate.stat_type == '1',  # Use '1' not 'mean'
                BaselineMortalityRate.allage_flag == False
            )}

            pm25_start = self.db.query(YearlyPM25Summary).filter_by(
                fips=fips, year=start_year).first()
            pm25_end = self.db.query(YearlyPM25Summary).filter_by(
                fips=fips, year=end_year).first()

            # Validation checks
            if not pop_start:
                logger.warning(
                    f"Skipping county {fips}: missing population for {start_year}")
                continue
            if not pop_end:
                logger.warning(
                    f"Skipping county {fips}: missing population for {end_year}")
                continue
            if not mort_start:
                logger.warning(
                    f"Skipping county {fips}: missing baseline mortality for {start_year}")
                continue
            if not mort_end:
                logger.warning(
                    f"Skipping county {fips}: missing baseline mortality for {end_year}")
                continue
            if not pm25_start:
                logger.warning(
                    f"Skipping county {fips}: missing PM2.5 for {start_year}")
                continue
            if not pm25_end:
                logger.warning(
                    f"Skipping county {fips}: missing PM2.5 for {end_year}")
                continue

            age_groups = sorted(set(pop_start) & set(
                pop_end) & set(mort_start) & set(mort_end))
            if not age_groups:
                logger.warning(
                    f"Skipping county {fips}: no overlapping age groups in all datasets")
                continue

            # Convert to vectors for efficient computation
            pop_start_vec = np.array([pop_start[a] for a in age_groups])
            pop_end_vec = np.array([pop_end[a] for a in age_groups])
            y0_start_vec = np.array([mort_start[a] for a in age_groups])
            y0_end_vec = np.array([mort_end[a] for a in age_groups])

            # Process both total and fire PM2.5 decompositions
            pm25_types = {
                'total': (pm25_start.avg_total, pm25_end.avg_total),
                'fire': None  # Will be calculated as total - nonfire
            }

            # Calculate fire PM2.5 as total - nonfire (matching your corrected method)
            if hasattr(pm25_start, 'avg_nonfire') and hasattr(pm25_end, 'avg_nonfire'):
                fire_start = pm25_start.avg_total - pm25_start.avg_nonfire
                fire_end = pm25_end.avg_total - pm25_end.avg_nonfire
                pm25_types['fire'] = (fire_start, fire_end)
            else:
                logger.warning(
                    f"County {fips}: missing nonfire PM2.5 data, skipping fire decomposition")

            for pm25_type, pm25_values in pm25_types.items():
                if pm25_values is None:
                    continue

                z_start, z_end = pm25_values

                # Calculate AF vectors for this PM2.5 type
                AF_start_vec = np.array([AF(z_start, a) for a in age_groups])
                AF_end_vec = np.array([AF(z_end, a) for a in age_groups])

                # Decomposition calculation (matching your corrected method)
                total_pop_start = pop_start_vec.sum()
                total_pop_end = pop_end_vec.sum()
                age_shares_start = pop_start_vec / total_pop_start
                pop_A = age_shares_start * total_pop_end

                # Step A: Population growth (2023 total pop, 2006 age structure, 2006 mortality, 2006 exposure)
                A = (pop_A * y0_start_vec * AF_start_vec).sum()
                # Step B: Population aging (2023 pop structure, 2006 mortality, 2006 exposure)
                B = (pop_end_vec * y0_start_vec * AF_start_vec).sum()
                # Step C: Mortality change (2023 pop structure, 2023 mortality, 2006 exposure)
                C = (pop_end_vec * y0_end_vec * AF_start_vec).sum()
                # Step D: Exposure change (2023 pop structure, 2023 mortality, 2023 exposure)
                D = (pop_end_vec * y0_end_vec * AF_end_vec).sum()

                total_burden_start = (
                    pop_start_vec * y0_start_vec * AF_start_vec).sum()

                # calculate changes and contributions
                total_change = D - total_burden_start
                pop_growth = (A - total_burden_start) / \
                    total_change * 100 if total_change != 0 else 0
                ageing = (B - A) / total_change * \
                    100 if total_change != 0 else 0
                mortality = (C - B) / total_change * \
                    100 if total_change != 0 else 0
                exposure = (D - C) / total_change * \
                    100 if total_change != 0 else 0
                total_change = total_change / total_burden_start * \
                    100 if total_burden_start != 0 else 0

                # Use the age_group field to store PM2.5 type without changing the model
                # age_group = -1 for total PM2.5, age_group = -2 for fire PM2.5
                age_group_code = -1 if pm25_type == 'total' else -2

                decomp = DecompositionSummary(
                    fips=fips,
                    start_year=start_year,
                    end_year=end_year,
                    age_group=age_group_code,  # Use negative values to distinguish PM2.5 types
                    population_growth=pop_growth,
                    population_ageing=ageing,
                    baseline_mortality_change=mortality,
                    exposure_change=exposure,
                    total_change=total_change
                )
                to_insert.append(decomp)

            if len(to_insert) >= 1000:
                self.db.bulk_save_objects(to_insert)
                self.db.commit()
                to_insert = []
            if idx % 100 == 0:
                logger.info(f"Processed {idx} counties...")

        if to_insert:
            self.db.bulk_save_objects(to_insert)
            self.db.commit()
        logger.info(
            "Decomposition summary loaded for all counties (total and fire PM2.5).")

    def load_fire_attribution_bins(self, hr_csv_path=None, af_csv_path=None):
        """
        Load both Bootstrapped Bin HRs and Precomputed Bin AFs into FireAttributionBin table.
        """
        logger.info("Loading fire attribution bins (HR and AF methods)...")
        if hr_csv_path is None:
            hr_csv_path = self.data_dir / "coef_poisson_bins_new.csv"
        if af_csv_path is None:
            af_csv_path = self.data_dir / "AF_smoke_causes_by age_formatted.csv"
        # Clear table first
        self.db.query(FireAttributionBin).delete()
        self.db.commit()
        # --- Load Bootstrapped Bin HRs ---
        logger.info(f"Loading Bootstrapped Bin HRs from {hr_csv_path}")
        hr_df = pd.read_csv(hr_csv_path)
        hr_records = []
        for _, row in hr_df.iterrows():
            # Parse bin string like (0.1,0.25]
            bin_str = row['bins'] if 'bins' in row else row['smokePM_bin']
            bin_str = bin_str.strip('()[]')
            try:
                bin_lower, bin_upper = [float(x) for x in bin_str.split(',')]
            except Exception as e:
                logger.warning(f"Could not parse bin: {bin_str} ({e})")
                continue
            hr_records.append(FireAttributionBin(
                method="bootstrapped_bin_hr",
                bin_lower=bin_lower,
                bin_upper=bin_upper,
                age_group=str(row['age_group']),
                cause=None,
                coef=float(row['coef']),
                af=None,
                ci_low=None,
                ci_up=None,
                bootid=int(row['bootid']) if 'bootid' in row and not pd.isna(
                    row['bootid']) else None
            ))
        self.db.bulk_save_objects(hr_records)
        self.db.commit()
        logger.info(f"Inserted {len(hr_records)} Bootstrapped Bin HR records.")
        # --- Load Precomputed Bin AFs ---
        logger.info(f"Loading Precomputed Bin AFs from {af_csv_path}")
        af_df = pd.read_csv(af_csv_path)
        af_records = []
        for _, row in af_df.iterrows():
            # Parse bin string like 0.1-0.2 or 5+
            bin_str = row['smokePM_bin']
            if bin_str.endswith('+'):
                try:
                    bin_lower = float(bin_str[:-1])
                    bin_upper = float('inf')
                except Exception as e:
                    logger.warning(
                        f"Could not parse open-ended bin: {bin_str} ({e})")
                    continue
            else:
                try:
                    bin_lower, bin_upper = [float(x)
                                            for x in bin_str.split('-')]
                except Exception as e:
                    logger.warning(f"Could not parse bin: {bin_str} ({e})")
                    continue
            af_records.append(FireAttributionBin(
                method="precomputed_bin_af",
                bin_lower=bin_lower,
                bin_upper=bin_upper,
                age_group=str(row['Age_group']),
                cause=str(row['cause']),
                coef=None,
                af=float(row['AF']) / 100 if not pd.isna(row['AF']) else None,
                ci_low=float(row['CI_LOW']) if not pd.isna(
                    row['CI_LOW']) else None,
                ci_up=float(row['CI_UP']) if not pd.isna(
                    row['CI_UP']) else None,
                bootid=None
            ))
        self.db.bulk_save_objects(af_records)
        self.db.commit()
        logger.info(f"Inserted {len(af_records)} Precomputed Bin AF records.")
        logger.info("Fire attribution bin loading complete.")

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
            mortality_count = self.db.query(ExcessMortalitySummary).count()

            logger.info(f"Data validation results:")
            logger.info(f"  Counties: {county_count:,}")
            logger.info(f"  Daily PM2.5 records: {pm25_count:,}")
            logger.info(f"  Population records: {population_count:,}")
            logger.info(f"  Yearly summaries: {yearly_count:,}")
            logger.info(f"  Monthly summaries: {monthly_count:,}")
            logger.info(f"  Seasonal summaries: {seasonal_count:,}")
            logger.info(f"  Mortality summaries: {mortality_count:,}")

            # Check for data quality issues
            null_dates = self.db.query(DailyPM25).filter(
                DailyPM25.date.is_(None)).count()
            negative_pm25 = self.db.query(DailyPM25).filter(
                DailyPM25.total < 0).count()

            if null_dates > 0:
                logger.warning(f"Found {null_dates} records with null dates")
            if negative_pm25 > 0:
                logger.warning(
                    f"Found {negative_pm25} records with negative PM2.5 values")

            # === NaN/NA VALUE CHECKS ===
            logger.info("Checking for NaN/NA values...")

            # Population NaN/NA checks
            pop_nan_checks = {
                'population': self.db.query(Population).filter(
                    Population.population != Population.population  # NaN != NaN is True
                ).count()
            }

            for field, count in pop_nan_checks.items():
                if count > 0:
                    logger.error(
                        f"Found {count} NaN values in Population.{field}")
                else:
                    logger.info(f"Population.{field}: No NaN values found")

            # Mortality NaN/NA checks (check all the key columns)
            mortality_nan_checks = {
                'total_excess': self.db.query(ExcessMortalitySummary).filter(
                    ExcessMortalitySummary.total_excess != ExcessMortalitySummary.total_excess
                ).count(),
                'fire_excess': self.db.query(ExcessMortalitySummary).filter(
                    ExcessMortalitySummary.fire_excess != ExcessMortalitySummary.fire_excess
                ).count(),
                'nonfire_excess': self.db.query(ExcessMortalitySummary).filter(
                    ExcessMortalitySummary.nonfire_excess != ExcessMortalitySummary.nonfire_excess
                ).count(),
                'yll_total': self.db.query(ExcessMortalitySummary).filter(
                    ExcessMortalitySummary.yll_total != ExcessMortalitySummary.yll_total
                ).count(),
                'yll_fire': self.db.query(ExcessMortalitySummary).filter(
                    ExcessMortalitySummary.yll_fire != ExcessMortalitySummary.yll_fire
                ).count(),
                'yll_nonfire': self.db.query(ExcessMortalitySummary).filter(
                    ExcessMortalitySummary.yll_nonfire != ExcessMortalitySummary.yll_nonfire
                ).count()
            }

            # Check method-specific columns if they exist
            try:
                if hasattr(ExcessMortalitySummary, 'total_gemm'):
                    mortality_nan_checks.update({
                        'total_gemm': self.db.query(ExcessMortalitySummary).filter(
                            ExcessMortalitySummary.total_gemm != ExcessMortalitySummary.total_gemm
                        ).count(),
                        'fire_gemm': self.db.query(ExcessMortalitySummary).filter(
                            ExcessMortalitySummary.fire_gemm != ExcessMortalitySummary.fire_gemm
                        ).count(),
                        'nonfire_gemm': self.db.query(ExcessMortalitySummary).filter(
                            ExcessMortalitySummary.nonfire_gemm != ExcessMortalitySummary.nonfire_gemm
                        ).count(),
                        'total_boot': self.db.query(ExcessMortalitySummary).filter(
                            ExcessMortalitySummary.total_boot != ExcessMortalitySummary.total_boot
                        ).count(),
                        'fire_boot': self.db.query(ExcessMortalitySummary).filter(
                            ExcessMortalitySummary.fire_boot != ExcessMortalitySummary.fire_boot
                        ).count(),
                        'total_prec': self.db.query(ExcessMortalitySummary).filter(
                            ExcessMortalitySummary.total_prec != ExcessMortalitySummary.total_prec
                        ).count(),
                        'fire_prec': self.db.query(ExcessMortalitySummary).filter(
                            ExcessMortalitySummary.fire_prec != ExcessMortalitySummary.fire_prec
                        ).count()
                    })
            except Exception as e:
                logger.info(
                    f"Method-specific columns not found (expected if using old schema): {e}")

            for field, count in mortality_nan_checks.items():
                if count > 0:
                    logger.error(
                        f"Found {count} NaN values in ExcessMortalitySummary.{field}")
                else:
                    logger.info(
                        f"ExcessMortalitySummary.{field}: No NaN values found")

            # PM2.5 Summary NaN/NA checks
            summary_nan_checks = {}

            # Yearly PM2.5 Summary checks
            yearly_fields = ['avg_total', 'avg_fire', 'avg_nonfire', 'max_total', 'max_fire', 'max_nonfire',
                             'pop_weighted_total', 'pop_weighted_fire', 'pop_weighted_nonfire']
            for field in yearly_fields:
                summary_nan_checks[f'YearlyPM25Summary.{field}'] = self.db.query(YearlyPM25Summary).filter(
                    getattr(YearlyPM25Summary, field) != getattr(
                        YearlyPM25Summary, field)
                ).count()

            # Monthly PM2.5 Summary checks
            monthly_fields = ['avg_total', 'avg_fire', 'avg_nonfire', 'max_total', 'max_fire', 'max_nonfire',
                              'pop_weighted_total', 'pop_weighted_fire', 'pop_weighted_nonfire']
            for field in monthly_fields:
                summary_nan_checks[f'MonthlyPM25Summary.{field}'] = self.db.query(MonthlyPM25Summary).filter(
                    getattr(MonthlyPM25Summary, field) != getattr(
                        MonthlyPM25Summary, field)
                ).count()

            # Seasonal PM2.5 Summary checks
            seasonal_fields = ['avg_total', 'avg_fire', 'avg_nonfire', 'max_total', 'max_fire', 'max_nonfire',
                               'pop_weighted_total', 'pop_weighted_fire', 'pop_weighted_nonfire']
            for field in seasonal_fields:
                summary_nan_checks[f'SeasonalPM25Summary.{field}'] = self.db.query(SeasonalPM25Summary).filter(
                    getattr(SeasonalPM25Summary, field) != getattr(
                        SeasonalPM25Summary, field)
                ).count()

            # Daily PM2.5 checks too
            daily_fields = ['total', 'fire', 'nonfire']
            for field in daily_fields:
                summary_nan_checks[f'DailyPM25.{field}'] = self.db.query(DailyPM25).filter(
                    getattr(DailyPM25, field) != getattr(DailyPM25, field)
                ).count()

            for field, count in summary_nan_checks.items():
                if count > 0:
                    logger.error(f"Found {count} NaN values in {field}")
                else:
                    logger.info(f"{field}: No NaN values found")

            # --- Population totals: US and by state ---
            # Find the latest year in the population table
            latest_year = self.db.query(func.min(Population.year)).scalar()
            logger.info(f"Latest year in population table: {latest_year}")

            # Query all population records for the latest year (sum across all age groups)
            pop_query = self.db.query(Population).filter(
                Population.year == latest_year, Population.age_group == 0)
            all_pops = pop_query.all()
            total_us_pop = sum(
                p.population for p in all_pops if p.population is not None)
            logger.info(
                f"Total US population (latest year, all age groups): {total_us_pop:,}")

            """ logger.info("Per-state population (latest year, all age groups):")
            for state, pop in sorted(state_pop.items()):
                logger.info(f"  {state}: {pop:,}") """

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
            # loader.create_tables()

            # Step 2: Load counties
            # loader.load_counties()

            # Step 3: Load population data (from API for 2009-2023)
            loader.load_population_data()
            loader.load_population_data_api()

            # Step 4: Load baseline mortality rates
            # loader.load_baseline_mortality()

            # Step 5: Load PM2.5 data (this will take the longest)
            # loader.load_pm25_data()

            # Step 6: Create indexes
            # loader.create_indexes()

            # Step 7: Generate aggregations
            # loader.preprocess_aggregations()

            # Step 8: Load fire attribution bins
            # loader.load_fire_attribution_bins()

            # Step 9: Compute and store excess mortality summary
            # loader.excess_mortality_summary()
            # loader.switch_default_method() # if need to change default method

            # Step 10: Load exceedance summary
            # loader.load_exceedance_summary()

            # Step 11: Load decomposition summary
            # loader.load_decomposition_summary()

            # Step 12: Validate data
            loader.validate_data()

        logger.info("=== Data Loading Process Completed Successfully ===")

    except Exception as e:
        logger.error(f"Data loading failed: {e}")
        raise


if __name__ == "__main__":
    main()
