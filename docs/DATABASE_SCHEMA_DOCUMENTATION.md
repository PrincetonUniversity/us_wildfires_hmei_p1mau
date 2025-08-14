# Database Schema Documentation

## Overview

The PM₂.₅ Wildfire Impact Map uses PostgreSQL with PostGIS extension for geospatial data storage. The database contains PM₂.₅ pollution data, population demographics, mortality statistics, and geospatial boundaries for US counties.

## Database Configuration

### Connection Setup

```python
# db/database.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set in the .env file.")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
```

### Environment Variables

```bash
# .env file
DATABASE_URL=postgresql://username:password@localhost:5432/pm25_dashboard
POSTGRES_DB=pm25_dashboard
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
```

### PostGIS Extension

```sql
-- Enable PostGIS extension for geospatial operations
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
```

## Schema Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    counties     │    │   daily_pm25    │    │   population    │
│                 │◄──►│                 │◄──►│                 │
│ - fips (PK)     │    │ - fips (FK)     │    │ - fips (FK)     │
│ - name          │    │ - date          │    │ - year          │
│ - geometry      │    │ - total         │    │ - age_group     │
└─────────────────┘    │ - fire          │    │ - population    │
                       │ - nonfire       │    └─────────────────┘
                       └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │ Summary Tables  │
                       │                 │
                       │ - yearly_pm25_  │
                       │   summary       │
                       │ - monthly_pm25_ │
                       │   summary       │
                       │ - seasonal_pm25_│
                       │   summary       │
                       │ - excess_mortality_│
                       │   summary       │
                       │ - exceedance_   │
                       │   summary       │
                       │ - decomposition_│
                       │   summary       │
                       └─────────────────┘
```

## Core Tables

### 1. counties

**Purpose**: Stores county boundaries and basic information.

**Schema**:
```sql
CREATE TABLE counties (
    fips VARCHAR(5) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    index INTEGER UNIQUE NOT NULL,
    geometry JSONB NOT NULL,
    state VARCHAR(2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Columns**:
- `fips` (VARCHAR(5), PK): County FIPS code (e.g., "06001")
- `name` (VARCHAR(100)): County name (e.g., "Alameda County")
- `index` (INTEGER, UNIQUE): Internal index for performance
- `geometry` (JSONB): GeoJSON geometry for county boundaries
- `state` (VARCHAR(2)): State abbreviation (e.g., "CA")
- `created_at` (TIMESTAMP): Record creation timestamp
- `updated_at` (TIMESTAMP): Record update timestamp

**Indexes**:
```sql
CREATE INDEX idx_counties_fips ON counties(fips);
CREATE INDEX idx_counties_name ON counties(name);
CREATE INDEX idx_counties_state ON counties(state);
CREATE INDEX idx_counties_geometry ON counties USING GIN(geometry);
CREATE INDEX idx_counties_index ON counties(index);
```

**Sample Data**:
```json
{
  "fips": "06001",
  "name": "Alameda County",
  "index": 1,
  "state": "CA",
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[...]]]
  }
}
```

### 2. daily_pm25

**Purpose**: Stores daily PM₂.₅ measurements for each county.

**Schema**:
```sql
CREATE TABLE daily_pm25 (
    id SERIAL PRIMARY KEY,
    fips VARCHAR(5) NOT NULL,
    county_index INTEGER NOT NULL,
    date DATE NOT NULL,
    total FLOAT NOT NULL,
    fire FLOAT NOT NULL,
    nonfire FLOAT NOT NULL,
    aqi INTEGER,
    smoke_day BOOLEAN,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (fips) REFERENCES counties(fips),
    UNIQUE(fips, date)
);
```

**Columns**:
- `id` (SERIAL, PK): Unique identifier
- `fips` (VARCHAR(5), FK): County FIPS code
- `county_index` (INTEGER): County index for performance
- `date` (DATE): Measurement date
- `total` (FLOAT): Total PM₂.₅ concentration (µg/m³)
- `fire` (FLOAT): Fire-related PM₂.₅ concentration (µg/m³)
- `nonfire` (FLOAT): Non-fire PM₂.₅ concentration (µg/m³)
- `aqi` (INTEGER): Calculated Air Quality Index
- `smoke_day` (BOOLEAN): Whether day was classified as smoke day
- `created_at` (TIMESTAMP): Record creation timestamp

**Indexes**:
```sql
CREATE INDEX idx_daily_pm25_fips ON daily_pm25(fips);
CREATE INDEX idx_daily_pm25_date ON daily_pm25(date);
CREATE INDEX idx_daily_pm25_county_index ON daily_pm25(county_index);
CREATE INDEX idx_daily_pm25_fips_date ON daily_pm25(fips, date);
CREATE INDEX idx_daily_pm25_smoke_day ON daily_pm25(smoke_day);
```

**Constraints**:
```sql
ALTER TABLE daily_pm25 ADD CONSTRAINT fk_daily_pm25_counties 
    FOREIGN KEY (fips) REFERENCES counties(fips) ON DELETE CASCADE;

ALTER TABLE daily_pm25 ADD CONSTRAINT unique_fips_date 
    UNIQUE(fips, date);

ALTER TABLE daily_pm25 ADD CONSTRAINT check_pm25_values 
    CHECK (total >= 0 AND fire >= 0 AND nonfire >= 0);
```

### 3. population

**Purpose**: Stores population data by county, year, and age group.

**Schema**:
```sql
CREATE TABLE population (
    id SERIAL PRIMARY KEY,
    fips VARCHAR(5) NOT NULL,
    year INTEGER NOT NULL,
    age_group INTEGER NOT NULL,
    population INTEGER NOT NULL,
    age_label VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (fips) REFERENCES counties(fips)
);
```

**Columns**:
- `id` (SERIAL, PK): Unique identifier
- `fips` (VARCHAR(5), FK): County FIPS code
- `year` (INTEGER): Population year
- `age_group` (INTEGER): Age group index (1-18)
- `population` (INTEGER): Population count
- `age_label` (VARCHAR(10)): Human-readable age range
- `created_at` (TIMESTAMP): Record creation timestamp

**Age Group Mapping**:
```sql
-- Age group definitions
INSERT INTO age_groups (index, label, min_age, max_age) VALUES
(1, '0-4', 0, 4),
(2, '5-9', 5, 9),
(3, '10-14', 10, 14),
(4, '15-19', 15, 19),
(5, '20-24', 20, 24),
(6, '25-29', 25, 29),
(7, '30-34', 30, 34),
(8, '35-39', 35, 39),
(9, '40-44', 40, 44),
(10, '45-49', 45, 49),
(11, '50-54', 50, 54),
(12, '55-59', 55, 59),
(13, '60-64', 60, 64),
(14, '65-69', 65, 69),
(15, '70-74', 70, 74),
(16, '75-79', 75, 79),
(17, '80-84', 80, 84),
(18, '85+', 85, 999);
```

**Indexes**:
```sql
CREATE INDEX idx_population_fips ON population(fips);
CREATE INDEX idx_population_year ON population(year);
CREATE INDEX idx_population_age_group ON population(age_group);
CREATE INDEX idx_population_fips_year ON population(fips, year);
```

## Summary Tables

### 4. yearly_pm25_summary

**Purpose**: Pre-computed yearly PM₂.₅ aggregations for performance.

**Schema**:
```sql
CREATE TABLE yearly_pm25_summary (
    id SERIAL PRIMARY KEY,
    fips VARCHAR(5) NOT NULL,
    year INTEGER NOT NULL,
    avg_total FLOAT NOT NULL,
    avg_fire FLOAT NOT NULL,
    avg_nonfire FLOAT NOT NULL,
    max_total FLOAT NOT NULL,
    max_fire FLOAT NOT NULL,
    max_nonfire FLOAT NOT NULL,
    pop_weighted_total FLOAT,
    pop_weighted_fire FLOAT,
    pop_weighted_nonfire FLOAT,
    days_count INTEGER NOT NULL,
    smoke_days INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (fips) REFERENCES counties(fips),
    UNIQUE(fips, year)
);
```

**Columns**:
- `id` (SERIAL, PK): Unique identifier
- `fips` (VARCHAR(5), FK): County FIPS code
- `year` (INTEGER): Summary year
- `avg_total` (FLOAT): Average total PM₂.₅
- `avg_fire` (FLOAT): Average fire-related PM₂.₅
- `avg_nonfire` (FLOAT): Average non-fire PM₂.₅
- `max_total` (FLOAT): Maximum total PM₂.₅
- `max_fire` (FLOAT): Maximum fire-related PM₂.₅
- `max_nonfire` (FLOAT): Maximum non-fire PM₂.₅
- `pop_weighted_total` (FLOAT): Population-weighted total PM₂.₅
- `pop_weighted_fire` (FLOAT): Population-weighted fire PM₂.₅
- `pop_weighted_nonfire` (FLOAT): Population-weighted non-fire PM₂.₅
- `days_count` (INTEGER): Number of days with data
- `smoke_days` (INTEGER): Number of smoke days

**Indexes**:
```sql
CREATE INDEX idx_yearly_pm25_fips ON yearly_pm25_summary(fips);
CREATE INDEX idx_yearly_pm25_year ON yearly_pm25_summary(year);
CREATE INDEX idx_yearly_pm25_fips_year ON yearly_pm25_summary(fips, year);
```

### 5. monthly_pm25_summary

**Purpose**: Pre-computed monthly PM₂.₅ aggregations.

**Schema**:
```sql
CREATE TABLE monthly_pm25_summary (
    id SERIAL PRIMARY KEY,
    fips VARCHAR(5) NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    avg_total FLOAT NOT NULL,
    avg_fire FLOAT NOT NULL,
    avg_nonfire FLOAT NOT NULL,
    max_total FLOAT NOT NULL,
    max_fire FLOAT NOT NULL,
    max_nonfire FLOAT NOT NULL,
    days_count INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (fips) REFERENCES counties(fips),
    UNIQUE(fips, year, month)
);
```

**Indexes**:
```sql
CREATE INDEX idx_monthly_pm25_fips ON monthly_pm25_summary(fips);
CREATE INDEX idx_monthly_pm25_year_month ON monthly_pm25_summary(year, month);
CREATE INDEX idx_monthly_pm25_fips_year_month ON monthly_pm25_summary(fips, year, month);
```

### 6. seasonal_pm25_summary

**Purpose**: Pre-computed seasonal PM₂.₅ aggregations.

**Schema**:
```sql
CREATE TABLE seasonal_pm25_summary (
    id SERIAL PRIMARY KEY,
    fips VARCHAR(5) NOT NULL,
    year INTEGER NOT NULL,
    season VARCHAR(10) NOT NULL,
    avg_total FLOAT NOT NULL,
    avg_fire FLOAT NOT NULL,
    avg_nonfire FLOAT NOT NULL,
    max_total FLOAT NOT NULL,
    max_fire FLOAT NOT NULL,
    max_nonfire FLOAT NOT NULL,
    days_count INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (fips) REFERENCES counties(fips),
    UNIQUE(fips, year, season)
);
```

**Season Definitions**:
```sql
-- Season definitions
INSERT INTO seasons (name, start_month, end_month) VALUES
('winter', 12, 2),
('spring', 3, 5),
('summer', 6, 8),
('fall', 9, 11);
```

**Indexes**:
```sql
CREATE INDEX idx_seasonal_pm25_fips ON seasonal_pm25_summary(fips);
CREATE INDEX idx_seasonal_pm25_year_season ON seasonal_pm25_summary(year, season);
CREATE INDEX idx_seasonal_pm25_fips_year_season ON seasonal_pm25_summary(fips, year, season);
```

### 7. excess_mortality_summary

**Purpose**: Pre-computed excess mortality calculations.

**Schema**:
```sql
CREATE TABLE excess_mortality_summary (
    id SERIAL PRIMARY KEY,
    fips VARCHAR(5) NOT NULL,
    year INTEGER NOT NULL,
    age_group INTEGER,
    excess_mortality FLOAT NOT NULL,
    total_excess FLOAT NOT NULL,
    fire_excess FLOAT NOT NULL,
    nonfire_excess FLOAT NOT NULL,
    yll_total FLOAT,
    yll_fire FLOAT,
    yll_nonfire FLOAT,
    population INTEGER,
    method VARCHAR(10) DEFAULT 'gemm',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (fips) REFERENCES counties(fips)
);
```

**Columns**:
- `id` (SERIAL, PK): Unique identifier
- `fips` (VARCHAR(5), FK): County FIPS code
- `year` (INTEGER): Mortality year
- `age_group` (INTEGER): Age group index (optional for total)
- `excess_mortality` (FLOAT): Excess mortality rate per 100 population
- `total_excess` (FLOAT): Total excess mortality count
- `fire_excess` (FLOAT): Fire-related excess mortality count
- `nonfire_excess` (FLOAT): Non-fire excess mortality count
- `yll_total` (FLOAT): Total Years of Life Lost
- `yll_fire` (FLOAT): Fire-related YLL
- `yll_nonfire` (FLOAT): Non-fire YLL
- `population` (INTEGER): County population for the year
- `method` (VARCHAR(10)): Calculation method (gemm, poisson, etc.)

**Indexes**:
```sql
CREATE INDEX idx_excess_mortality_fips ON excess_mortality_summary(fips);
CREATE INDEX idx_excess_mortality_year ON excess_mortality_summary(year);
CREATE INDEX idx_excess_mortality_age_group ON excess_mortality_summary(age_group);
CREATE INDEX idx_excess_mortality_fips_year ON excess_mortality_summary(fips, year);
CREATE INDEX idx_excess_mortality_method ON excess_mortality_summary(method);
```

### 8. exceedance_summary

**Purpose**: Pre-computed regulatory exceedance data.

**Schema**:
```sql
CREATE TABLE exceedance_summary (
    id SERIAL PRIMARY KEY,
    fips VARCHAR(5) NOT NULL,
    year INTEGER NOT NULL,
    threshold_8 INTEGER NOT NULL,
    threshold_9 INTEGER NOT NULL,
    exceedance_days_8 INTEGER NOT NULL,
    exceedance_days_9 INTEGER NOT NULL,
    fire_exceedance_days_8 INTEGER,
    fire_exceedance_days_9 INTEGER,
    nonfire_exceedance_days_8 INTEGER,
    nonfire_exceedance_days_9 INTEGER,
    avg_pm25_8 FLOAT,
    avg_pm25_9 FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (fips) REFERENCES counties(fips),
    UNIQUE(fips, year)
);
```

**Exceedance Categories**:
```sql
-- Exceedance category definitions
-- threshold_8 and threshold_9 values:
-- 0: Below the threshold
-- 1: Exceeding due to fire smoke on Tier 1 days
-- 2: Exceeding due to fire smoke on Tier 1&2 days
-- 3: Exceeding due to fire smoke on Tier 1,2,3 days
-- 4: Exceeding even after excluding fire smoke on all Tier 1,2,3 days
```

**Indexes**:
```sql
CREATE INDEX idx_exceedance_fips ON exceedance_summary(fips);
CREATE INDEX idx_exceedance_year ON exceedance_summary(year);
CREATE INDEX idx_exceedance_fips_year ON exceedance_summary(fips, year);
CREATE INDEX idx_exceedance_threshold_8 ON exceedance_summary(threshold_8);
CREATE INDEX idx_exceedance_threshold_9 ON exceedance_summary(threshold_9);
```

### 9. decomposition_summary

**Purpose**: Pre-computed mortality decomposition analysis.

**Schema**:
```sql
CREATE TABLE decomposition_summary (
    id SERIAL PRIMARY KEY,
    fips VARCHAR(5) NOT NULL,
    pm25_type VARCHAR(10) DEFAULT 'total',
    start_year INTEGER NOT NULL,
    end_year INTEGER NOT NULL,
    population_growth FLOAT NOT NULL,
    population_ageing FLOAT NOT NULL,
    baseline_mortality_change FLOAT NOT NULL,
    exposure_change FLOAT NOT NULL,
    total_change FLOAT NOT NULL,
    methodology TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (fips) REFERENCES counties(fips),
    UNIQUE(fips, pm25_type)
);
```

**Columns**:
- `id` (SERIAL, PK): Unique identifier
- `fips` (VARCHAR(5), FK): County FIPS code
- `pm25_type` (VARCHAR(10)): PM₂.₅ type for analysis
- `start_year` (INTEGER): Analysis start year
- `end_year` (INTEGER): Analysis end year
- `population_growth` (FLOAT): Population growth contribution
- `population_ageing` (FLOAT): Population aging contribution
- `baseline_mortality_change` (FLOAT): Baseline mortality change contribution
- `exposure_change` (FLOAT): Exposure change contribution
- `total_change` (FLOAT): Total mortality change
- `methodology` (TEXT): Methodology description

**Indexes**:
```sql
CREATE INDEX idx_decomposition_fips ON decomposition_summary(fips);
CREATE INDEX idx_decomposition_pm25_type ON decomposition_summary(pm25_type);
CREATE INDEX idx_decomposition_fips_pm25_type ON decomposition_summary(fips, pm25_type);
```

## Supporting Tables

### 10. baseline_mortality

**Purpose**: Stores baseline mortality rates for health impact calculations.

**Schema**:
```sql
CREATE TABLE baseline_mortality (
    id SERIAL PRIMARY KEY,
    fips VARCHAR(5) NOT NULL,
    year INTEGER NOT NULL,
    age_group INTEGER NOT NULL,
    baseline_rate FLOAT NOT NULL,
    source VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (fips) REFERENCES counties(fips)
);
```

**Indexes**:
```sql
CREATE INDEX idx_baseline_mortality_fips ON baseline_mortality(fips);
CREATE INDEX idx_baseline_mortality_year ON baseline_mortality(year);
CREATE INDEX idx_baseline_mortality_age_group ON baseline_mortality(age_group);
```

### 11. mortality_coefficients

**Purpose**: Stores concentration-response function coefficients.

**Schema**:
```sql
CREATE TABLE mortality_coefficients (
    id SERIAL PRIMARY KEY,
    age_group INTEGER NOT NULL,
    pm25_bin_min FLOAT NOT NULL,
    pm25_bin_max FLOAT NOT NULL,
    coefficient FLOAT NOT NULL,
    standard_error FLOAT,
    method VARCHAR(20),
    source VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes**:
```sql
CREATE INDEX idx_mortality_coefficients_age_group ON mortality_coefficients(age_group);
CREATE INDEX idx_mortality_coefficients_pm25_bin ON mortality_coefficients(pm25_bin_min, pm25_bin_max);
CREATE INDEX idx_mortality_coefficients_method ON mortality_coefficients(method);
```

## Data Loading and Maintenance

### Data Loading Process

```python
# db/load_data.py
class DataLoader:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self.engine = create_engine(DATABASE_URL)
        
    def create_tables(self):
        """Create all database tables."""
        Base.metadata.create_all(bind=self.engine)
        
    def load_counties(self, shapefile_path: str):
        """Load county boundaries from shapefile."""
        gdf = gpd.read_file(shapefile_path)
        # Process and insert county data
        
    def load_pm25_data(self, filepath: str, chunk_size: int = 10000):
        """Load daily PM₂.₅ data with chunking."""
        # Load data in chunks for large files
        
    def preprocess_aggregations(self):
        """Create summary tables for efficient querying."""
        # Generate yearly, monthly, seasonal summaries
        
    def calculate_excess_mortality(self, method: str = "gemm"):
        """Calculate excess mortality using specified method."""
        # Implement mortality calculations
        
    def generate_exceedance_data(self):
        """Generate regulatory exceedance data."""
        # Calculate exceedance categories

---

This comprehensive database schema documentation provides developers and database administrators with all necessary information to understand the PM₂.₅ Wildfire Impact Map database structure and relationships. 