# PM₂.₅ Wildfire Impact Map - Comprehensive Documentation

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture Overview](#architecture-overview)
3. [Key Features](#key-features)
4. [Technology Stack](#technology-stack)
5. [Data Sources](#data-sources)
6. [Backend Documentation](#backend-documentation)
   - [FastAPI Application (`app.py`)](#fastapi-application-apppy)
   - [Database Layer (`db/`)](#database-layer-db)
   - [Data Processing (`data/` and `analysis/`)](#data-processing-data-and-analysis)
7. [Frontend Documentation](#frontend-documentation)
   - [React Application Structure](#react-application-structure)
   - [Component Architecture](#component-architecture)
   - [Data Flow and State Management](#data-flow-and-state-management)
8. [API Reference](#api-reference)
9. [Development Setup](#development-setup)
10. [Deployment](#deployment)
11. [Research Foundation](#research-foundation)

---

## Project Overview

The PM₂.₅ Wildfire Impact Map is an interactive platform designed to explore how fine particulate matter (PM₂.₅) from wildfire smoke affects public health across the United States. By integrating high-resolution air quality estimates with demographic and mortality data, the tool provides a clear picture of how wildfire smoke contributes to health risks over time and across regions.

The platform enables detailed examination of both spatial and temporal patterns, allowing users to move seamlessly between nationwide trends and localized county-level insights. This makes it possible to identify areas with the highest smoke-related health burdens, track changes over multiple years, and compare patterns between fire and non-fire sources of PM₂.₅.

### Mission

Our mission is to transform complex environmental health research into clear, interactive insights. By visualizing the drivers and impacts of wildfire-related air pollution, we aim to:

- Support evidence-based decision-making for public health and environmental policy
- Highlight geographic and demographic disparities in exposure and outcomes
- Increase public awareness of the health risks posed by wildfire smoke

### Development Team

This project was developed by an undergraduate intern at Princeton University's High Meadows Environmental Institute with the Center for Policy Research on Energy and the Environment. See Partners for more information.

---

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   (React)       │◄──►│   (FastAPI)     │◄──►│   (PostgreSQL)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Components    │    │   API Routes    │    │   Data Models   │
│   - Map         │    │   - Choropleth  │    │   - Counties    │
│   - Charts      │    │   - Statistics  │    │   - PM25 Data   │
│   - Controls    │    │   - Mortality   │    │   - Population  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Data Flow

1. **Data Ingestion**: Raw PM₂.₅ data, population data, and geospatial boundaries are processed and loaded into PostgreSQL
2. **Preprocessing**: Summary tables are created for efficient querying (yearly, monthly, seasonal aggregations)
3. **API Layer**: FastAPI provides RESTful endpoints for data access
4. **Frontend**: React components fetch data via API and render interactive visualizations
5. **User Interaction**: Users can filter by time periods, geographic regions, and metrics

---

## Key Features

### Interactive Maps
- County-level PM₂.₅ exposure and mortality metrics with dynamic color-coded choropleth visualization
- Real-time hover and click interactions for county information
- Dynamic legend with context-aware color scales

### Multi-Layer Analysis
- Switch between PM₂.₅ data (average, maximum, population-weighted) and health metrics (mortality, YLL, population)
- Source attribution for fire vs. non-fire PM₂.₅ contributions

### Time-Scale Analysis
- Daily, monthly, seasonal, and annual views with flexible time controls
- Temporal trend analysis with interactive charts

### County Profiles
- Detailed county information panels showing PM₂.₅ statistics, population data, and health metrics
- Localized PM₂.₅ charts, exceedance categories, and mortality summaries

### Interactive Charts
- Bar charts showing temporal trends in PM₂.₅ levels and mortality rates by source
- Decomposition analysis charts for mortality changes

### Data Downloads
- CSV export functionality for PM₂.₅, excess mortality, and YLL data
- Configurable time periods and age group filtering
- Research-ready data formats with proper headers and metadata

### Decomposition Analysis
- Breakdowns of mortality changes into demographic (population growth, aging) and environmental (exposure change, baseline mortality) contributions
- Based on established methodology from Yang et al. (2022)

### Mortality Analysis
- Age-group specific mortality data with both death counts and Years of Life Lost (YLL) metrics
- Statistical models using CRFs and risk ratios from Burnett et al. (2018), Ma et al. (2024), and Qiu et al. (2024)

### Exceedance Tracking
- Monitor counties where 2021-2023 average PM₂.₅ levels exceed EPA air quality standards (8 and 9 µg/m³)
- Fire vs. non-fire attribution for exceedance days

### Population Weighting
- Population-weighted exposure calculations to account for varying county populations
- Demographic breakdowns by age group

---

## Technology Stack

**Backend:**
- FastAPI (Python web framework)
- SQLAlchemy (ORM)
- PostgreSQL with PostGIS (Geospatial database)
- GeoPandas (Geospatial data processing)
- Uvicorn (ASGI server)
- Pandas & NumPy (Data processing)

**Frontend:**
- React 18 (JavaScript framework)
- Maplibre GL JS (Interactive maps)
- Recharts (Data visualization)
- Material-UI (Component library)
- React Map GL (Mapbox React wrapper)

**Data Processing:**
- Python (Data analysis and processing)
- GeoPandas (Geospatial operations)
- Pandas (Data manipulation)
- NumPy (Numerical computations)

---

## Data Sources

### PM₂.₅ Data Sources
1. **Surface Smoke Observations (2000–2023)**: NOAA's Integrated Surface Database (ISD) using ~1,400 U.S. weather stations
2. **Satellite Smoke Observations (2006–2023)**: NOAA's Hazard Mapping System (HMS) using GOES and polar satellites
3. **PM₂.₅ and Organic Carbon Data (2006–2023)**: EPA's Air Quality System (AQS) network
4. **Model Simulations (GFDL AM4VR, 2021–2023)**: High-resolution simulations using satellite-based fire data

### Health and Demographic Data
1. **Baseline Mortality Rate (2000–2019)**: CDC WONDER and GBD US Health Disparities Collaborators
2. **Life Expectancy Data**: CDC county-level estimates
3. **Population Data (2006–2023)**: US Census API (5-year ACS post-2009, 1-year ACS 2006-2009)
4. **PM Attribution Bins**: Research from Ma et al. (2024) and Qiu et al. (2024)

### Data Quality Controls
- Exclude ISD stations with <11 years of data or outlier smoke day frequencies
- Exclude ISD smoke days outside typical fire seasons
- Remove invalid HMS polygons and filter low-quality EPA data
- Seasonal windows adjusted (±45 to ±90 days) for reliable comparison

---

## Backend Documentation

### FastAPI Application (`app.py`)

The main FastAPI application serves as the backend API for the dashboard, providing endpoints for data access, geospatial queries, and statistical analysis.

#### Application Structure

```python
# Core imports and configuration
import logging
import warnings
from datetime import datetime, date
from contextlib import asynccontextmanager
from typing import Optional
from concurrent.futures import ThreadPoolExecutor

# FastAPI and database imports
from fastapi import FastAPI, HTTPException, Query, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, and_, extract
from sqlalchemy.orm import Session

# Geospatial processing
import geopandas as gpd
from shapely.geometry import mapping
```

#### Key Components

**1. Application Lifespan Management**
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize resources
    logger.info("Starting up...")
    load_county_geometries()  # Cache county boundaries
    yield
    # Shutdown: Clean up resources
    logger.info("Shutting down...")
    executor.shutdown(wait=True)
```

**2. Database Session Management**
```python
def get_db():
    """Dependency that provides a DB session with error handling."""
    db = SessionLocal()
    try:
        yield db
    except SQLAlchemyError as e:
        logger.error("Database error: %s", str(e))
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred"
        )
    finally:
        db.close()
```

**3. Geospatial Data Caching**
```python
def load_county_geometries():
    """Load county geometries from shapefile and cache them for performance."""
    global COUNTY_GEOMETRIES
    if COUNTY_GEOMETRIES is None:
        # Load shapefile and convert to GeoJSON format
        # Index by FIPS code for fast lookup
```

#### API Endpoints

**Choropleth Data Endpoints**

The application provides several choropleth endpoints for different types of data visualization:

1. **Mortality Impact Choropleth** (`/api/counties/choropleth/mortality`)
   - Returns excess mortality data by county
   - Supports filtering by age groups
   - Calculates mortality rates per population

2. **PM₂.₅ Average Choropleth** (`/api/counties/choropleth/average`)
   - Returns average PM₂.₅ levels by county
   - Supports total, fire, and non-fire PM₂.₅ metrics
   - Time scale filtering (yearly, monthly, seasonal)

3. **PM₂.₅ Maximum Choropleth** (`/api/counties/choropleth/max`)
   - Returns maximum PM₂.₅ levels by county
   - Useful for identifying peak pollution events

4. **Population-Weighted PM₂.₅** (`/api/counties/choropleth/pop_weighted`)
   - Returns population-weighted PM₂.₅ averages
   - Accounts for population density in calculations

5. **Population Choropleth** (`/api/counties/choropleth/population`)
   - Returns population data by county
   - Supports different years

6. **Years of Life Lost (YLL)** (`/api/counties/choropleth/yll`)
   - Returns YLL data normalized by population
   - Supports age group filtering

**Query Building Helper Functions**

```python
def build_choropleth_query(db, time_scale, year, month, season, summary_model):
    """Builds SQLAlchemy queries for choropleth data based on time scale."""
    # Handles yearly, monthly, and seasonal queries
    # Joins with county and population data
    # Applies appropriate filters
```

**Data Processing Helper Functions**

```python
def build_geojson_features(results, value_func):
    """Converts database results to GeoJSON features."""
    # Handles geometry conversion
    # Applies value function for different metrics
    # Ensures proper JSON serialization
```

**Bar Chart Data Endpoint** (`/api/pm25/bar_chart/{fips}`)

Provides time-series data for individual counties:

```python
@app.get("/api/pm25/bar_chart/{fips}")
async def get_bar_chart_data(
    fips: str,
    time_scale: str = Query("yearly", pattern="^(yearly|monthly|seasonal|daily)$"),
    start_year: Optional[int] = Query(None),
    end_year: Optional[int] = Query(None),
    # ... other parameters
):
    """
    Returns preprocessed bar chart data for a specific county.
    Uses summary tables for better performance.
    """
```

**County Statistics Endpoint** (`/api/counties/statistics`)

Provides statistical summaries across all counties:

```python
@app.get("/api/counties/statistics")
async def get_county_statistics(
    time_scale: str = Query("yearly", pattern="^(yearly|monthly|seasonal)$"),
    year: Optional[int] = Query(None),
    # ... other parameters
):
    """
    Returns statistical summaries (mean, median, min, max) across all counties.
    """
```

**Excess Mortality Endpoint** (`/api/excess_mortality`)

Provides mortality impact data:

```python
@app.get("/api/excess_mortality")
def get_excess_mortality_summary(
    year: int = Query(None),
    fips: str = Query(None),
    sub_metric: str = Query("total", pattern="^(total|fire|nonfire)$"),
    age_group: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Returns precomputed excess mortality summary data.
    Supports filtering by year, county, and age groups.
    """
```

**Decomposition Analysis Endpoint** (`/api/counties/decomp/{fips}`)

Provides mortality decomposition data:

```python
@app.get("/api/counties/decomp/{fips}")
def get_county_decomposition_info(
    fips: str,
    pm25_type: str = "total",
    db: Session = Depends(get_db)
):
    """
    Returns decomposition analysis for factors contributing to mortality changes.
    """
```

### Database Layer (`db/`)

The database layer provides data models, connection management, and data loading utilities.

#### Database Connection (`db/database.py`)

```python
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

#### Data Models (`db/models.py`)

The application uses SQLAlchemy ORM with the following key models:

**1. County Model**
```python
class County(Base):
    __tablename__ = "counties"
    
    fips = Column(String, primary_key=True, index=True)
    name = Column(String)
    index = Column(Integer, unique=True)
    geometry = Column(JSONB)  # Store GeoJSON as JSONB
    
    # Relationships
    pm25_data = relationship("DailyPM25", back_populates="county")
    populations = relationship("Population", back_populates="county")
    yearly_summaries = relationship("YearlyPM25Summary", back_populates="county")
    # ... other relationships
```

**2. Daily PM₂.₅ Data**
```python
class DailyPM25(Base):
    __tablename__ = "daily_pm25"
    
    id = Column(Integer, primary_key=True, index=True)
    fips = Column(String, ForeignKey("counties.fips"), index=True, nullable=False)
    county_index = Column(Integer, index=True, nullable=False)
    date = Column(Date, index=True, nullable=False)
    total = Column(Float, nullable=False)  # Total PM₂.₅
    fire = Column(Float, nullable=False)    # Fire-related PM₂.₅
    nonfire = Column(Float, nullable=False)  # Non-fire PM₂.₅
    aqi = Column(Integer, nullable=True)  # Calculated AQI
    
    __table_args__ = (UniqueConstraint("fips", "date", name="_fips_date_uc"),)
```

**3. Summary Tables**

The application uses precomputed summary tables for efficient querying:

- `YearlyPM25Summary`: Annual aggregations
- `MonthlyPM25Summary`: Monthly aggregations  
- `SeasonalPM25Summary`: Seasonal aggregations
- `ExcessMortalitySummary`: Mortality impact calculations
- `ExceedanceSummary`: Regulatory exceedance data
- `DecompositionSummary`: Mortality decomposition analysis

**4. Population Data**
```python
class Population(Base):
    __tablename__ = "population"
    
    id = Column(Integer, primary_key=True)
    fips = Column(String, ForeignKey("counties.fips"))
    year = Column(Integer, index=True)
    age_group = Column(Integer)
    population = Column(Integer)
```

#### Data Loading (`db/load_data.py`)

The `DataLoader` class handles data ingestion and preprocessing:

```python
class DataLoader:
    def __init__(self, data_dir: str = "data"):
        """Initialize data loader with directory path."""
        
    def create_tables(self):
        """Create all database tables."""
        
    def load_shapefiles(self, shapefile_path: Optional[str] = None):
        """Load county boundary shapefiles."""
        
    def load_counties(self, fips_filepath: Optional[str] = None, shapefile_path: Optional[str] = None):
        """Load county data with FIPS codes and geometries."""
        
    def load_population_data(self, filepath: Optional[str] = None):
        """Load population data by county, year, and age group."""
        
    def load_pm25_data(self, filepath: Optional[str] = None, chunk_size: int = 10000):
        """Load daily PM₂.₅ data with chunking for large files."""
        
    def preprocess_aggregations(self):
        """Create summary tables for efficient querying."""
        
    def excess_mortality_summary(self, default_method="gemm"):
        """Calculate excess mortality using various methods."""
        
    def load_exceedance_summary(self, filepath: Optional[str] = None):
        """Load exceedance data for regulatory analysis."""
        
    def load_decomposition_summary(self, start_year=2006, end_year=2023):
        """Calculate mortality decomposition factors."""
```

#### Data Export (`db/export_data.py`)

Provides utilities for exporting data to CSV format:

```python
def export_model_to_csv(model_class, output_csv):
    """Export database model to CSV file."""
    
def main():
    """Command-line interface for data export."""
```

### Data Processing (`data/` and `analysis/`)

The data directory contains raw data files and the analysis directory contains Jupyter notebooks for data exploration and preprocessing.

**Key Data Files:**
- `daily_county_data_combined_2006.csv`: Raw PM₂.₅ data
- `population_2006_2023.csv`: Population data
- `all_basemor_results.csv`: Baseline mortality data
- `coef_poisson_bins_new.csv`: Mortality coefficients
- `county_tier_category.csv`: Regulatory tier data

**Analysis Notebooks:**
- `mortality_analysis.ipynb`: Mortality impact analysis
- `decomposition.ipynb`: Mortality decomposition analysis
- `cdc_vs_baseline_eda.ipynb`: Baseline mortality comparison
- `aqs_vs_main_eda.ipynb`: Air quality data validation

---

## Frontend Documentation

### React Application Structure

```
src/
├── App.js                 # Main application component
├── index.js              # Application entry point
├── components/           # React components
│   ├── Map.js           # Interactive map component
│   ├── Sidebar.js       # Control panel
│   ├── LayerControl.js  # Layer selection
│   ├── LayerTimeControls.js # Time and metric controls
│   ├── Legend.js        # Map legend
│   ├── CountyInfoPanel.js # County information panel
│   ├── CountyBarChart.js # PM₂.₅ time series chart
│   ├── CountyMortalityBarChart.js # Mortality chart
│   ├── CountyDecompositionChart.js # Decomposition chart
│   ├── About.js         # About page
│   ├── Partners.js      # Partners page
│   └── Methodology.js   # Data & Methodology page
├── styles/
│   └── style.css        # Global styles
└── utils/
    ├── api.js           # API utility functions
    ├── aqi.js           # AQI calculation utilities
    └── mapUtils.js      # Map utility functions
```

### State Management

The application uses React hooks for state management with a top-down data flow pattern:

#### Global State (App.js)

```javascript
// Layer and metric state
const [activeLayer, setActiveLayer] = useState('average');
const [pm25SubLayer, setPm25SubLayer] = useState('total');
const [mortalitySubMetric, setMortalitySubMetric] = useState('total');

// Time controls
const [timeControls, setTimeControls] = useState({
  timeScale: 'yearly',
  year: 2023,
  month: 1,
  season: 'winter'
});

// County selection and interaction
const [selectedCounty, setSelectedCounty] = useState(null);
const [hoveredCounty, setHoveredCounty] = useState(null);
const [selectedAgeGroups, setSelectedAgeGroups] = useState([]);

// UI state
const [loading, setLoading] = useState(false);
const [mapRefreshKey, setMapRefreshKey] = useState(0);
const [activeTab, setActiveTab] = useState('map');
```

#### State Flow

```
User Interaction → Event Handler → State Update → 
Component Re-render → API Call → Data Update → UI Update
```

### Component Architecture

#### Core Components

1. **Map.js**: Interactive choropleth map using Maplibre GL JS
2. **Sidebar.js**: Control panel with layer selection and time controls
3. **LayerTimeControls.js**: Time scale and metric selection controls
4. **CountyInfoPanel.js**: Detailed county information display
5. **CountyBarChart.js**: PM₂.₅ time series visualization
6. **CountyMortalityBarChart.js**: Mortality and YLL charts
7. **CountyDecompositionChart.js**: Decomposition analysis charts

#### Data Visualization

- **Choropleth Maps**: Dynamic color coding based on selected metrics
- **Time Series Charts**: Interactive bar charts with fire vs. non-fire breakdowns
- **Mortality Charts**: Age-group specific health impact visualizations
- **Decomposition Charts**: Factor contribution analysis

---

## API Reference

### Base URL
```
https://usfirepollution.mauzerall.scholar.princeton.edu
```

### Authentication
Currently, the API does not require authentication. All endpoints are publicly accessible.

### Response Format
All API responses are in JSON format. Geospatial data is returned as GeoJSON FeatureCollections.

### Error Handling
The API uses standard HTTP status codes:
- `200 OK`: Successful request
- `400 Bad Request`: Invalid parameters
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

### Key Endpoints

#### Choropleth Data
- `GET /api/counties/choropleth/average` - Average PM₂.₅ data
- `GET /api/counties/choropleth/max` - Maximum PM₂.₅ data
- `GET /api/counties/choropleth/pop_weighted` - Population-weighted PM₂.₅ data
- `GET /api/counties/choropleth/mortality` - Mortality data
- `GET /api/counties/choropleth/yll` - Years of Life Lost data
- `GET /api/counties/choropleth/population` - Population data
- `GET /api/counties/choropleth/exceedance_8` - Exceedance data (8 µg/m³ threshold)
- `GET /api/counties/choropleth/exceedance_9` - Exceedance data (9 µg/m³ threshold)

#### Time Series Data
- `GET /api/pm25/bar_chart/{fips}` - County-specific PM₂.₅ time series
- `GET /api/excess_mortality?fips={fips}` - County mortality data
- `GET /api/counties/decomp/{fips}` - Decomposition analysis data

#### Parameters
- `time_scale`: yearly, monthly, seasonal, daily
- `year`: 2006-2023
- `month`: 1-12 (for monthly data)
- `season`: winter, spring, summer, fall (for seasonal data)
- `sub_metric`: total, fire, nonfire
- `age_groups`: comma-separated age group indices

---

## Development Setup

### Prerequisites
- Python 3.8+
- Node.js 16+
- PostgreSQL 12+ with PostGIS extension
- Git

### Backend Setup
```bash
# Clone repository
git clone <repository-url>
cd web_interface

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Run database migrations
alembic upgrade head

# Start backend server
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup
```bash
# Install dependencies
npm install

# Start development server
npm start
```

### Database Setup
```bash
# Create database
createdb pm25_dashboard

# Enable PostGIS extension
psql pm25_dashboard -c "CREATE EXTENSION postgis;"

# Run data loading scripts
python db/load_data.py
```

---

## Deployment

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up --build

# Or build individual containers
docker build -f Dockerfile.backend -t pm25-backend .
docker build -f Dockerfile.frontend -t pm25-frontend .
```

### Production Considerations
- Use production-grade database (e.g., AWS RDS, Google Cloud SQL)
- Implement proper logging and monitoring
- Set up reverse proxy (nginx) for production deployment
- Configure CORS properly for production domains
- Implement rate limiting and security measures

---

## Research Foundation

### Methodology
This platform implements established methodologies for:
- **PM₂.₅ Smoke Attribution**: Comparing smoke day levels to seasonal non-smoke day baselines
- **Health Impact Calculations**: Using CRFs and risk ratios from peer-reviewed research
- **Decomposition Analysis**: Analyzing demographic and environmental factors contributing to mortality trends

### Key Research Papers
1. **Burnett et al. (2018)**: Global estimates of mortality associated with long-term exposure to outdoor fine particulate matter
2. **Ma et al. (2024)**: Long-term exposure to wildland fire smoke PM₂.₅ and mortality in the contiguous United States
3. **Qiu et al. (2024)**: Wildfire smoke exposure and mortality burden in the US under future climate change
4. **Yang et al. (2022)**: Socio-demographic factors shaping the future global health burden from air pollution
5. **GBD US Health Disparities Collaborators (2023)**: Cause-specific mortality by county, race, and ethnicity in the USA, 2000–19

### Statistical Models
- **GEMM Hazard Ratio Function**: HR(z) = exp(θ × log(1 + z/α) × ω(z))
- **Binned Poisson Model**: D_csy = exp(Σᵢ βᵢ smokeBINⁱ_csy + γW_csy + η_sy + θ_c + ε_csy)

### Ongoing Research
This interface is part of an ongoing research paper:
**Tentative Title**: "Improving estimates of wildfire smoke contributions to surface PM₂.₅ pollution to support US air quality management"

**Authors**: Yuanyu Xie, Denise L. Mauzerall, Meiyun Lin, Janiya Angoy, Bonne Ford, Jennifer McGinnis, Jeffrey R. Pierce, Larry W. Horowitz, Tianjia Liu, Mi Zhou, Beichen Lv, Hassan Khan

---

## Support and Contact

For technical support or research inquiries, please refer to the Partners section of the application or contact the development team through the methodology documentation.

This platform represents a collaborative effort between Princeton University's research institutions, combining technical development expertise with environmental science and policy research capabilities. 