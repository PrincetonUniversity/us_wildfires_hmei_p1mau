import logging
from contextlib import asynccontextmanager
from datetime import datetime, date, timedelta
from pathlib import Path
from typing import Optional, List, Dict, Any
import os
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query, Depends, status, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.encoders import jsonable_encoder
from sqlalchemy import func, and_, or_, extract, select
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.sql.expression import case

# Application imports
from db.database import SessionLocal, engine, Base
from db.models import DailyPM25, County, Population

import geopandas as gpd
from shapely.geometry import mapping, shape
import warnings

# Suppress warnings from GeoPandas
warnings.filterwarnings('ignore', message='.*initial implementation of Parquet.*')

# Load county geometries once at startup
COUNTY_GEOMETRIES = None

def load_county_geometries():
    """Load county geometries from the shapefile and cache them."""
    global COUNTY_GEOMETRIES
    if COUNTY_GEOMETRIES is None:
        try:
            # Path to the county boundaries shapefile
            shapefile_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                'data', 'shapefiles', 'cb_2018_us_county_20m.shp'
            )
            
            # Read the shapefile
            gdf = gpd.read_file(shapefile_path)
            
            # Create a FIPS code column by combining state and county codes
            gdf['FIPS'] = gdf['STATEFP'] + gdf['COUNTYFP']
            
            # Convert to GeoJSON and index by FIPS code
            COUNTY_GEOMETRIES = {}
            for _, row in gdf.iterrows():
                # Convert the row to a GeoJSON feature
                feature = {
                    'type': 'Feature',
                    'geometry': mapping(row['geometry']),
                    'properties': {
                        'FIPS': row['FIPS'],
                        'NAME': row.get('NAME', ''),
                        'STATEFP': row.get('STATEFP', ''),
                        'COUNTYFP': row.get('COUNTYFP', '')
                    }
                }
                COUNTY_GEOMETRIES[row['FIPS']] = feature['geometry']
            
            logger.info(f"Loaded {len(COUNTY_GEOMETRIES)} county geometries")
            
        except Exception as e:
            logger.error(f"Error loading county geometries: {str(e)}", exc_info=True)
            COUNTY_GEOMETRIES = {}
    
    return COUNTY_GEOMETRIES

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('app.log')
    ]
)
logger = logging.getLogger(__name__)

# Create database tables if they don't exist
Base.metadata.create_all(bind=engine)

# Cache configuration
CACHE_TTL = 300  # 5 minutes

# Application lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize resources
    logger.info("Starting up...")
    
    # Create database tables if they don't exist
    Base.metadata.create_all(bind=engine)
    
    yield
    
    # Shutdown: Clean up resources
    logger.info("Shutting down...")

# Initialize FastAPI app with lifespan
app = FastAPI(
    title="PM2.5 Wildfire Dashboard",
    description="API for accessing PM2.5 wildfire data",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for development
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"]   # Allows all headers
)

# Paths
BASE_DIR = '/Users/hassankhan/Desktop/HMEI/Project/'
DATA_DIR = BASE_DIR + "data/"
COUNTIES_SHP = DATA_DIR + "shapefiles/cb_2018_us_county_20m.shp"
POPULATION_CSV = DATA_DIR + "population_2021_2023.csv"
FIPS_CSV = DATA_DIR + "FIPScode.csv"
DAILY_DATA_CSV = DATA_DIR + "daily_county_data_combined.csv"

# Database session dependency
def get_db():
    """Dependency that provides a DB session."""
    db = SessionLocal()
    try:
        yield db
    except SQLAlchemyError as e:
        logger.error(f"Database error: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred"
        )
    finally:
        db.close()

def get_season_date_range(year: int, season: str):
    season = season.lower()
    if season == "winter":
        start_date = date(year-1, 12, 21)
        end_date = date(year, 3, 20)
    elif season == "spring":
        start_date = date(year, 3, 21)
        end_date = date(year, 6, 20)
    elif season == "summer":
        start_date = date(year, 6, 21)
        end_date = date(year, 9, 20)
    elif season == "fall":
        start_date = date(year, 9, 21)
        end_date = date(year, 12, 20)
    else:
        raise ValueError("Invalid season")
    return start_date, end_date



# Helper function to parse and validate date input
def parse_flexible_date(date_str: str) -> date:
    """Parse a date string into a date object with flexible format."""
    try:
        if len(date_str) == 4:  # Just year (e.g., '2023')
            return datetime.strptime(f"{date_str}-01-01", "%Y-%m-%d").date()
        elif len(date_str) == 7:  # Year and month (e.g., '2023-01')
            return datetime.strptime(f"{date_str}-01", "%Y-%m-%d").date()
        else:  # Full date (e.g., '2023-01-01')
            return datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid date format: {date_str}. Use YYYY, YYYY-MM, or YYYY-MM-DD."
        ) from e


# Helper function to parse and validate date input
def parse_date(date_str: str) -> date:
    """Parse date string to date object with validation."""
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError as e:
        logger.warning(f"Invalid date format: {date_str}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid date format: {date_str}. Use YYYY-MM-DD."
        ) from e

# Cache for frequently accessed data
from functools import lru_cache

@lru_cache(maxsize=1000)
def get_cached_pm25_data(
    fips: str,
    start_date: date,
    end_date: date,
    period: str
) -> List[Dict[str, Any]]:
    """Get PM2.5 data with caching for better performance."""
    db = SessionLocal()
    try:
        # Base query with correct column names from our schema
        query = db.query(
            extract('year', DailyPM25.date).label("year"),
            extract('month', DailyPM25.date).label("month"),
            extract('day', DailyPM25.date).label("day"),
            func.avg(DailyPM25.total).label("avg_total_pm25"),
            func.avg(DailyPM25.fire).label("avg_fire_pm25"),
        ).filter(
            DailyPM25.fips == fips,
            DailyPM25.date.between(start_date, end_date)
        )
        
        # Apply grouping based on period
        if period == "yearly":
            query = query.group_by(extract('year', DailyPM25.date))
        elif period == "monthly":
            query = query.group_by(
                extract('year', DailyPM25.date),
                extract('month', DailyPM25.date)
            )
        
        results = query.order_by("year", "month", "day").all()
        
        return [
            {
                "year": int(r.year) if r.year else None,
                "month": int(r.month) if hasattr(r, 'month') and r.month is not None else None,
                "day": int(r.day) if hasattr(r, 'day') and r.day is not None else None,
                "avg_total_pm25": float(r.avg_total_pm25) if r.avg_total_pm25 is not None else None,
                "avg_fire_pm25": float(r.avg_fire_pm25) if r.avg_fire_pm25 is not None else None,
                "avg_nonfire_pm25": float(r.avg_total_pm25 - r.avg_fire_pm25) 
                    if r.avg_total_pm25 is not None and r.avg_fire_pm25 is not None 
                    else None,
            }
            for r in results
        ]
    except Exception as e:
        logger.error(f"Error fetching PM2.5 data: {str(e)}", exc_info=True)
        raise
    finally:
        db.close()

@app.get("/api/pm25/{fips}", response_model=Dict[str, Any])
async def get_pm25(
    request: Request,
    fips: str,
    period: str = Query("yearly", pattern="^(daily|monthly|seasonal|yearly|custom)$"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    season: Optional[str] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """
    Get PM2.5 data for a specific county and time period.
    
    Parameters:
    - fips: County FIPS code
    - period: Time period aggregation ('daily', 'monthly', 'seasonal', 'yearly', 'custom')
    - start_date: Start date (YYYY, YYYY-MM, or YYYY-MM-DD), required for 'custom' period
    - end_date: End date (YYYY, YYYY-MM, or YYYY-MM-DD), required for 'custom' period
    - season: Season name (e.g., 'winter', 'spring', 'summer', 'fall'), required for 'seasonal' period
    - year: Year (YYYY), required for 'seasonal' period
    
    Returns:
    - JSON response with PM2.5 data and metadata
    """
    try:
        # Validate FIPS code exists
        county = db.query(County).filter(County.fips == fips).first()
        if not county:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"County with FIPS code {fips} not found"
            )
        
        # Handle different time periods
        if period == "custom":
            if not start_date or not end_date:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="start_date and end_date are required for custom period"
                )
                
            # Parse dates with flexible format
            start = parse_flexible_date(start_date)
            end = parse_flexible_date(end_date)
            
            # Adjust end date based on input format
            if len(end_date) == 4:  # Year only
                end = datetime(end.year, 12, 31).date()
            elif len(end_date) == 7:  # Year and month
                next_month = datetime(end.year, end.month % 12 + 1, 1) if end.month < 12 else datetime(end.year + 1, 1, 1)
                end = (next_month - timedelta(days=1)).date()
            
            # Ensure end date is not before start date
            if end < start:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="end_date must be after start_date"
                )
                
            # Get data for the custom date range
            data = get_cached_pm25_data(fips, start, end, period)
            
            return {
                "fips": fips,
                "county_name": county.name,
                "period": "custom",
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
                "data": data
            }
            
        elif period == "seasonal":
            if not season or not year:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="season and year are required for seasonal period"
                )
            try:
                start, end = get_season_date_range(year, season)
            except ValueError as e:
                logger.warning(f"Invalid season: {season}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid season: {season}. Must be one of: winter, spring, summer, fall"
                ) from e

        elif period == "yearly":
            # Default to full date range if not specified
            start = date(2013, 1, 1)
            end = date(2023, 12, 31)
        
        # Log the request
        logger.info(f"Fetching PM2.5 data for FIPS: {fips}, Period: {period}, "
                   f"Start: {start}, End: {end}")
        
        # Get data from cache or database
        data = get_cached_pm25_data(fips, start, end, period)
        
        if not data:
            logger.warning(f"No data found for FIPS: {fips} in the specified date range")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No data found for the specified parameters"
            )
            
        return {
            "period": period,
            "fips": fips,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "data": data
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Log unexpected errors
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {str(e)}"
        ) from e

@app.get("/api/pm25/bar_chart/{fips}")
def get_pm25_bar_chart(
    fips: str,
    period: str = Query("yearly", pattern="^(daily|monthly|seasonal|yearly|custom)$"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    season: Optional[str] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
):
    # Reuse date parsing helper
    def parse_date(s):
        try:
            return datetime.strptime(s, "%Y-%m-%d").date()
        except:
            raise HTTPException(status_code=400, detail=f"Invalid date format: {s}. Use YYYY-MM-DD.")

    # Determine date range based on period
    if period in ["custom", "daily", "monthly"]:
        if not start_date or not end_date:
            raise HTTPException(status_code=400, detail="start_date and end_date required for this period")
        start = parse_date(start_date)
        end = parse_date(end_date)
        if start > end:
            raise HTTPException(status_code=400, detail="start_date must be before or equal to end_date")

    elif period == "seasonal":
        if not season or not year:
            raise HTTPException(status_code=400, detail="season and year required for seasonal period")
        try:
            start, end = get_season_date_range(year, season)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid season")

    elif period == "yearly":
        start = date(2013, 1, 1)
        end = date(2023, 12, 31)

    else:
        raise HTTPException(status_code=400, detail="Unsupported period")

    # Query PM2.5 for the date range and fips
    query = db.query(
        extract('year', DailyPM25.date).label("year"),
        extract('month', DailyPM25.date).label("month"),
        extract('day', DailyPM25.date).label("day"),
        func.avg(DailyPM25.total).label("avg_total_pm25"),
        func.avg(DailyPM25.fire).label("avg_fire_pm25"),
    ).filter(
        DailyPM25.fips == fips,
        DailyPM25.date.between(start, end)
    )

    # Grouping depends on period
    if period == "yearly":
        query = query.group_by(extract('year', DailyPM25.date)).order_by(extract('year', DailyPM25.date))
        results = query.all()
        data = [
            {
                "year": int(r.year) if r.year else None,
                "avg_total_pm25": float(r.avg_total_pm25) if r.avg_total_pm25 is not None else None,
                "avg_fire_pm25": float(r.avg_fire_pm25) if r.avg_fire_pm25 is not None else None,
                "avg_nonfire_pm25": float(r.avg_total_pm25 - r.avg_fire_pm25) 
                    if r.avg_total_pm25 is not None and r.avg_fire_pm25 is not None 
                    else None,
            } for r in results
        ]

    elif period == "monthly":
        query = query.group_by(
            extract('year', DailyPM25.date),
            extract('month', DailyPM25.date)
        ).order_by(
            extract('year', DailyPM25.date),
            extract('month', DailyPM25.date)
        )
        results = query.all()
        data = [
            {
                "year": int(r.year) if r.year else None,
                "month": int(r.month) if r.month is not None else None,
                "avg_total_pm25": float(r.avg_total_pm25) if r.avg_total_pm25 is not None else None,
                "avg_fire_pm25": float(r.avg_fire_pm25) if r.avg_fire_pm25 is not None else None,
                "avg_nonfire_pm25": float(r.avg_total_pm25 - r.avg_fire_pm25) 
                    if r.avg_total_pm25 is not None and r.avg_fire_pm25 is not None 
                    else None,
            } for r in results
        ]

    elif period in ["daily", "seasonal", "custom"]:
        query = query.group_by(
            extract('year', DailyPM25.date),
            extract('month', DailyPM25.date),
            extract('day', DailyPM25.date)
        ).order_by(
            extract('year', DailyPM25.date),
            extract('month', DailyPM25.date),
            extract('day', DailyPM25.date)
        )
        results = query.all()
        data = [
            {
                "year": int(r.year) if r.year else None,
                "month": int(r.month) if r.month is not None else None,
                "day": int(r.day) if r.day is not None else None,
                "avg_total_pm25": float(r.avg_total_pm25) if r.avg_total_pm25 is not None else None,
                "avg_fire_pm25": float(r.avg_fire_pm25) if r.avg_fire_pm25 is not None else None,
                "avg_nonfire_pm25": float(r.avg_total_pm25 - r.avg_fire_pm25) 
                    if r.avg_total_pm25 is not None and r.avg_fire_pm25 is not None 
                    else None,
            } for r in results
        ]

    else:
        raise HTTPException(status_code=400, detail="Unsupported period")

    return {"period": period, "fips": fips, "data": data}



@app.on_event("startup")
async def startup_event():
    """Load county geometries when the application starts."""
    load_county_geometries()

@app.get("/api/counties")
async def get_counties_data(
    start_date: str = Query(..., description="Start date in YYYY-MM-DD format"),
    end_date: str = Query(..., description="End date in YYYY-MM-DD format"),
    time_scale: str = Query("period", description="Time scale: daily, monthly, seasonal, yearly, period"),
    db: Session = Depends(get_db)
):
    """
    Get PM2.5 and population data for all counties within a date range.
    Returns GeoJSON with properties for PM2.5 and population data.
    """
    try:
        # Parse dates
        start = parse_flexible_date(start_date)
        
        # Adjust end date based on input format
        if len(end_date) == 4:  # Year only
            end = datetime(start.year, 12, 31).date()
        elif len(end_date) == 7:  # Year and month
            end_month = datetime.strptime(end_date, "%Y-%m").date()
            next_month = end_month.replace(day=28) + timedelta(days=4)  # Get to next month
            end = (next_month - timedelta(days=next_month.day)).date()  # Last day of month
        else:
            end = parse_flexible_date(end_date)

        # Base query with joins and filters
        query = db.query(
            County.fips,
            County.name.label("county_name"),
            func.avg(DailyPM25.total).label("avg_total_pm25"),
            func.avg(DailyPM25.fire).label("fire_pm25"),
            (func.avg(DailyPM25.total) - func.avg(DailyPM25.fire)).label("nonfire_pm25"),
            County.geometry,
            func.avg(Population.population).label("population")
        ).join(
            DailyPM25, DailyPM25.fips == County.fips
        ).outerjoin(
            Population, and_(
                Population.fips == County.fips,
                Population.year == extract('year', DailyPM25.date)
            )
        ).filter(
            # Exclude Puerto Rico
            ~County.fips.startswith('72'),
            # Date range filter
            DailyPM25.date.between(start, end)
        )

        # Group by based on time scale
        if time_scale == "yearly":
            query = query.group_by(
                extract('year', DailyPM25.date),
                County.fips,
                County.name,
                County.geometry
            ).order_by(
                extract('year', DailyPM25.date)
            )
        elif time_scale == "monthly":
            query = query.group_by(
                extract('year', DailyPM25.date),
                extract('month', DailyPM25.date),
                County.fips,
                County.name,
                County.geometry
            ).order_by(
                extract('year', DailyPM25.date),
                extract('month', DailyPM25.date)
            )
        else:  # daily, seasonal, period
            query = query.group_by(
                DailyPM25.date,
                County.fips,
                County.name,
                County.geometry
            ).order_by(DailyPM25.date)

        # Execute query
        results = query.all()

        # Process results into GeoJSON
        features = []
        for row in results:
            # Skip rows without geometry
            if not row.geometry:
                continue
                
            feature = {
                "type": "Feature",
                "geometry": row.geometry,
                "properties": {
                    "FIPS": row.fips,
                    "county_name": row.county_name,
                    "avg_total_pm25": float(row.avg_total_pm25) if row.avg_total_pm25 is not None else 0,
                    "fire_pm25": float(row.fire_pm25) if row.fire_pm25 is not None else 0,
                    "nonfire_pm25": float(row.nonfire_pm25) if row.nonfire_pm25 is not None else 0,
                    "population": int(row.population) if row.population is not None else 0
                }
            }
            features.append(feature)

        return {
            "type": "FeatureCollection",
            "features": features
        }

    except Exception as e:
        logger.error(f"Error in get_counties_data: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def read_root():
    """Serve the main HTML file"""
    return FileResponse("static/index.html")

if __name__ == "__main__":
    import uvicorn
    import logging
    
    # Configure Uvicorn logging
    log_config = uvicorn.config.LOGGING_CONFIG
    log_config["loggers"]["uvicorn.error"]["level"] = "WARNING"
    log_config["loggers"]["uvicorn.access"]["level"] = "WARNING"
    log_config["loggers"]["uvicorn"]["level"] = "WARNING"
    
    # Disable watchfiles logging
    logging.getLogger("watchfiles").setLevel(logging.WARNING)
    
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="warning",
        log_config=log_config
    )
