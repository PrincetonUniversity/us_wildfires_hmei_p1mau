import logging
from contextlib import asynccontextmanager
from datetime import datetime, date
from pathlib import Path
from typing import Optional
import os
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query, Depends, status, Request, Response, BackgroundTasks, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.encoders import jsonable_encoder
from sqlalchemy import func, and_, or_, extract, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from concurrent.futures import ThreadPoolExecutor
import math

# Application imports
from db.database import SessionLocal, engine, Base
from db.models import (
    DailyPM25, County, Population, Demographics,
    YearlyPM25Summary, MonthlyPM25Summary, SeasonalPM25Summary,
    BaselineMortalityRate
)

import geopandas as gpd
from shapely.geometry import mapping
import warnings

# Suppress warnings from GeoPandas
warnings.filterwarnings('ignore', message='.*initial implementation of Parquet.*')

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
# Base.metadata.create_all(bind=engine)

# Cache configuration
CACHE_TTL = 300  # 5 minutes
executor = ThreadPoolExecutor(max_workers=4)

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

# Application lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize resources
    logger.info("Starting up...")
    
    # Load county geometries
    load_county_geometries()
    
    yield
    
    # Shutdown: Clean up resources
    logger.info("Shutting down...")
    executor.shutdown(wait=True)

# Initialize FastAPI app with lifespan
app = FastAPI(
    title="PM2.5 Wildfire Dashboard",
    description="API for accessing PM2.5 wildfire data with preprocessed summaries",
    version="2.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

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

# Helper functions
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

def get_season_from_date(date_obj: date) -> str:
    """Determine season from a date."""
    month = date_obj.month
    day = date_obj.day
    
    if (month == 12 and day >= 21) or month in [1, 2] or (month == 3 and day < 21):
        return "winter"
    elif (month == 3 and day >= 21) or month in [4, 5] or (month == 6 and day < 21):
        return "spring"
    elif (month == 6 and day >= 21) or month in [7, 8] or (month == 9 and day < 21):
        return "summer"
    else:
        return "fall"

# Data preprocessing functions
async def preprocess_summary_data(db: Session):
    """Preprocess and populate summary tables for faster queries."""
    try:
        logger.info("Starting data preprocessing...")
        
        # Clear existing summary data
        db.query(YearlyPM25Summary).delete()
        db.query(MonthlyPM25Summary).delete()
        db.query(SeasonalPM25Summary).delete()
        
        # Generate yearly summaries
        yearly_query = db.query(
            DailyPM25.fips,
            extract('year', DailyPM25.date).label('year'),
            func.avg(DailyPM25.total).label('avg_total'),
            func.avg(DailyPM25.fire).label('avg_fire'),
            func.avg(DailyPM25.nonfire).label('avg_nonfire'),
            func.max(DailyPM25.total).label('max_total'),
            func.max(DailyPM25.fire).label('max_fire'),
            func.count().label('days_count')
        ).group_by(
            DailyPM25.fips,
            extract('year', DailyPM25.date)
        )
        
        yearly_results = yearly_query.all()
        yearly_summaries = []
        
        for result in yearly_results:
            yearly_summaries.append(YearlyPM25Summary(
                fips=result.fips,
                year=int(result.year),
                avg_total=float(result.avg_total),
                avg_fire=float(result.avg_fire),
                avg_nonfire=float(result.avg_nonfire),
                max_total=float(result.max_total),
                max_fire=float(result.max_fire),
                days_count=int(result.days_count)
            ))
        
        db.bulk_save_objects(yearly_summaries)
        
        # Generate monthly summaries
        monthly_query = db.query(
            DailyPM25.fips,
            extract('year', DailyPM25.date).label('year'),
            extract('month', DailyPM25.date).label('month'),
            func.avg(DailyPM25.total).label('avg_total'),
            func.avg(DailyPM25.fire).label('avg_fire'),
            func.avg(DailyPM25.nonfire).label('avg_nonfire'),
            func.max(DailyPM25.total).label('max_total'),
            func.max(DailyPM25.fire).label('max_fire'),
            func.count().label('days_count')
        ).group_by(
            DailyPM25.fips,
            extract('year', DailyPM25.date),
            extract('month', DailyPM25.date)
        )
        
        monthly_results = monthly_query.all()
        monthly_summaries = []
        
        for result in monthly_results:
            monthly_summaries.append(MonthlyPM25Summary(
                fips=result.fips,
                year=int(result.year),
                month=int(result.month),
                avg_total=float(result.avg_total),
                avg_fire=float(result.avg_fire),
                avg_nonfire=float(result.avg_nonfire),
                max_total=float(result.max_total),
                max_fire=float(result.max_fire),
                days_count=int(result.days_count)
            ))
        
        db.bulk_save_objects(monthly_summaries)
        
        # Generate seasonal summaries
        daily_data = db.query(DailyPM25).all()
        seasonal_data = {}
        
        for record in daily_data:
            season = get_season_from_date(record.date)
            year = record.date.year
            
            # Adjust year for winter season
            if season == "winter" and record.date.month in [1, 2, 3]:
                year = year  # Winter belongs to the ending year
            elif season == "winter" and record.date.month == 12:
                year = year + 1  # December belongs to next year's winter
            
            key = (record.fips, year, season)
            
            if key not in seasonal_data:
                seasonal_data[key] = {
                    'total_values': [],
                    'fire_values': [],
                    'nonfire_values': []
                }
            
            seasonal_data[key]['total_values'].append(record.total)
            seasonal_data[key]['fire_values'].append(record.fire)
            seasonal_data[key]['nonfire_values'].append(record.nonfire)
        
        seasonal_summaries = []
        for (fips, year, season), values in seasonal_data.items():
            seasonal_summaries.append(SeasonalPM25Summary(
                fips=fips,
                year=year,
                season=season,
                avg_total=float(np.mean(values['total_values'])),
                avg_fire=float(np.mean(values['fire_values'])),
                avg_nonfire=float(np.mean(values['nonfire_values'])),
                max_total=float(np.max(values['total_values'])),
                max_fire=float(np.max(values['fire_values'])),
                days_count=len(values['total_values'])
            ))
        
        db.bulk_save_objects(seasonal_summaries)
        db.commit()
        
        logger.info(f"Preprocessed {len(yearly_summaries)} yearly, {len(monthly_summaries)} monthly, and {len(seasonal_summaries)} seasonal summaries")
        
    except Exception as e:
        logger.error(f"Error in preprocessing: {str(e)}", exc_info=True)
        db.rollback()
        raise

# API Endpoints

@app.post("/api/admin/preprocess")
async def trigger_preprocessing(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Trigger preprocessing of summary data."""
    background_tasks.add_task(preprocess_summary_data, db)
    return {"message": "Preprocessing started in background"}

# --- Helper Functions for Choropleth Endpoints ---
def build_choropleth_query(db, time_scale, year, month, season, summary_model):
    if time_scale == "yearly":
        if not year:
            raise HTTPException(status_code=400, detail="Year required for yearly data")
        query = db.query(
            summary_model.fips,
            County.name.label("county_name"),
            County.geometry,
            summary_model.avg_total,
            summary_model.avg_fire,
            summary_model.avg_nonfire,
            summary_model.max_total,
            summary_model.max_fire,
            summary_model.max_nonfire,
            summary_model.pop_weighted_total,
            summary_model.pop_weighted_fire,
            summary_model.pop_weighted_nonfire,
            Population.population
        ).join(
            County, County.fips == summary_model.fips
        ).outerjoin(
            Population, and_(
                Population.fips == summary_model.fips,
                Population.year == year
            )
        ).filter(
            summary_model.year == year,
            ~County.fips.startswith('72')
        )
    elif time_scale == "monthly":
        if not year or not month:
            raise HTTPException(status_code=400, detail="Year and month required for monthly data")
        query = db.query(
            summary_model.fips,
            County.name.label("county_name"),
            County.geometry,
            summary_model.avg_total,
            summary_model.avg_fire,
            summary_model.avg_nonfire,
            summary_model.max_total,
            summary_model.max_fire,
            summary_model.max_nonfire,
            summary_model.pop_weighted_total,
            summary_model.pop_weighted_fire,
            summary_model.pop_weighted_nonfire,
            Population.population
        ).join(
            County, County.fips == summary_model.fips
        ).outerjoin(
            Population, and_(
                Population.fips == summary_model.fips,
                Population.year == year
            )
        ).filter(
            summary_model.year == year,
            summary_model.month == month,
            ~County.fips.startswith('72')
        )
    elif time_scale == "seasonal":
        if not year or not season:
            raise HTTPException(status_code=400, detail="Year and season required for seasonal data")
        query = db.query(
            summary_model.fips,
            County.name.label("county_name"),
            County.geometry,
            summary_model.avg_total,
            summary_model.avg_fire,
            summary_model.avg_nonfire,
            summary_model.max_total,
            summary_model.max_fire,
            summary_model.max_nonfire,
            summary_model.pop_weighted_total,
            summary_model.pop_weighted_fire,
            summary_model.pop_weighted_nonfire,
            Population.population
        ).join(
            County, County.fips == summary_model.fips
        ).outerjoin(
            Population, and_(
                Population.fips == summary_model.fips,
                Population.year == year
            )
        ).filter(
            summary_model.year == year,
            summary_model.season == season.lower(),
            ~County.fips.startswith('72')
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid time_scale")
    return query

def build_geojson_features(results, value_func):
    features = []
    for row in results:
        if not row.geometry:
            continue
        feature = {
            "type": "Feature",
            "geometry": row.geometry,
            "properties": {
                "fips": row.fips,
                "county_name": row.county_name,
                "value": float(value_func(row)),
                "avg_total": float(row.avg_total) if row.avg_total is not None else 0,
                "avg_fire": float(row.avg_fire) if row.avg_fire is not None else 0,
                "avg_nonfire": float(row.avg_nonfire) if row.avg_nonfire is not None else 0,
                "max_total": float(row.max_total) if row.max_total is not None else 0,
                "max_fire": float(row.max_fire) if row.max_fire is not None else 0,
                "max_nonfire": float(row.max_nonfire) if row.max_nonfire is not None else 0,
                "pop_weighted_total": float(row.pop_weighted_total) if row.pop_weighted_total is not None else 0,
                "pop_weighted_fire": float(row.pop_weighted_fire) if row.pop_weighted_fire is not None else 0,
                "pop_weighted_nonfire": float(row.pop_weighted_nonfire) if row.pop_weighted_nonfire is not None else 0,
                "population": int(row.population) if row.population is not None else 0
            }
        }
        features.append(feature)
    return features

# --- New Modular Endpoints ---
choropleth_router = APIRouter(prefix="/api/counties/choropleth", tags=["Choropleth"])

@choropleth_router.get("/mortality")
async def get_choropleth_mortality(
    year: int = Query(..., description="Year required for mortality data"),
    db: Session = Depends(get_db)
):
    """Get mortality impact choropleth data."""
    try:
        # Build query for mortality data using LEFT JOINs to handle missing data
        query = db.query(
            County.fips,
            County.name.label("county_name"),
            County.geometry,
            YearlyPM25Summary.avg_total.label("pm25"),
            Population.population,
            func.avg(BaselineMortalityRate.value).label("y0_avg")
        ).join(
            YearlyPM25Summary, and_(
                YearlyPM25Summary.fips == County.fips,
                YearlyPM25Summary.year == year
            )
        ).outerjoin(  # Use LEFT JOIN for population
            Population, and_(
                Population.fips == County.fips,
                Population.year == year
            )
        ).outerjoin(  # Use LEFT JOIN for baseline mortality rate
            BaselineMortalityRate, and_(
                BaselineMortalityRate.fips == County.fips,
                BaselineMortalityRate.year == year,
                BaselineMortalityRate.stat_type == '1',
                BaselineMortalityRate.source == 'basemor_ALL'
            )
        ).filter(
            ~County.fips.startswith('72')  # Exclude Puerto Rico
        ).group_by(
            County.fips,
            County.name,
            County.geometry,
            YearlyPM25Summary.avg_total,
            Population.population
        )
        
        results = query.all()
        features = []
        
        beta = 0.0058  # GEMM coefficient
        
        for row in results:
            if not row.geometry:
                continue
                
            pm25 = row.pm25 or 0
            pop = row.population or 0
            y0 = row.y0_avg or 0
            
            # Ensure all are valid numbers
            if pm25 is None or not math.isfinite(pm25):
                pm25 = 0
            if pop is None or not math.isfinite(pop):
                pop = 0
            if y0 is None or not math.isfinite(y0):
                y0 = 0
            
            # Calculate excess mortality
            delta_mortality = pop * y0 * (np.exp(beta * pm25) - 1)
            if not math.isfinite(delta_mortality):
                delta_mortality = 0
            
            feature = {
                "type": "Feature",
                "geometry": row.geometry,
                "properties": {
                    "fips": row.fips,
                    "county_name": row.county_name,
                    "value": float(delta_mortality),
                    "pm25": float(pm25),
                    "population": int(pop),
                    "y0": float(y0),
                    "delta_mortality": float(delta_mortality)
                }
            }
            features.append(feature)
        
        return {
            "type": "FeatureCollection",
            "features": features,
            "metadata": {
                "time_scale": "yearly",
                "year": year,
                "metric": "mortality",
                "feature_count": len(features)
            }
        }
        
    except Exception as e:
        logger.error(f"Error in mortality choropleth: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@choropleth_router.get("/average")
async def get_choropleth_average(
    time_scale: str = Query("yearly", pattern="^(yearly|monthly|seasonal)$"),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    season: Optional[str] = Query(None),
    sub_metric: str = Query("total", pattern="^(total|fire|nonfire)$"),
    db: Session = Depends(get_db)
):
    """Get average PM2.5 choropleth data."""
    summary_model = {
        "yearly": YearlyPM25Summary,
        "monthly": MonthlyPM25Summary,
        "seasonal": SeasonalPM25Summary
    }[time_scale]
    query = build_choropleth_query(db, time_scale, year, month, season, summary_model)
    results = query.all()
    col_map = {
        "total": "avg_total",
        "fire": "avg_fire",
        "nonfire": "avg_nonfire"
    }
    col_name = col_map.get(sub_metric, "avg_total")
    def value_func(row):
        return float(getattr(row, col_name) or 0)
    features = build_geojson_features(results, value_func)
    return {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "time_scale": time_scale,
            "year": year,
            "month": month,
            "season": season,
            "metric": col_name,
            "feature_count": len(features)
        }
    }

@choropleth_router.get("/max")
async def get_choropleth_max(
    time_scale: str = Query("yearly", pattern="^(yearly|monthly|seasonal)$"),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    season: Optional[str] = Query(None),
    sub_metric: str = Query("total", pattern="^(total|fire|nonfire)$"),
    db: Session = Depends(get_db)
):
    """Get max PM2.5 choropleth data."""
    summary_model = {
        "yearly": YearlyPM25Summary,
        "monthly": MonthlyPM25Summary,
        "seasonal": SeasonalPM25Summary
    }[time_scale]
    query = build_choropleth_query(db, time_scale, year, month, season, summary_model)
    results = query.all()
    col_map = {
        "total": "max_total",
        "fire": "max_fire",
        "nonfire": "max_nonfire"
    }
    col_name = col_map.get(sub_metric, "max_total")
    def value_func(row):
        return float(getattr(row, col_name) or 0)
    features = build_geojson_features(results, value_func)
    return {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "time_scale": time_scale,
            "year": year,
            "month": month,
            "season": season,
            "metric": col_name,
            "feature_count": len(features)
        }
    }

@choropleth_router.get("/pop_weighted")
async def get_choropleth_pop_weighted(
    time_scale: str = Query("yearly", pattern="^(yearly|monthly|seasonal)$"),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    season: Optional[str] = Query(None),
    sub_metric: str = Query("total", pattern="^(total|fire|nonfire)$"),
    db: Session = Depends(get_db)
):
    """Get population-weighted PM2.5 choropleth data."""
    summary_model = {
        "yearly": YearlyPM25Summary,
        "monthly": MonthlyPM25Summary,
        "seasonal": SeasonalPM25Summary
    }[time_scale]
    query = build_choropleth_query(db, time_scale, year, month, season, summary_model)
    results = query.all()
    col_map = {
        "total": "pop_weighted_total",
        "fire": "pop_weighted_fire",
        "nonfire": "pop_weighted_nonfire"
    }
    col_name = col_map.get(sub_metric, "pop_weighted_total")
    def value_func(row):
        return float(getattr(row, col_name) or 0)
    features = build_geojson_features(results, value_func)
    return {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "time_scale": time_scale,
            "year": year,
            "month": month,
            "season": season,
            "metric": col_name,
            "feature_count": len(features)
        }
    }

@choropleth_router.get("/population")
async def get_choropleth_population(
    year: Optional[int] = Query(2020, description="Year for population data (optional, defaults to 2020)"),
    db: Session = Depends(get_db)
):
    """Get population choropleth data."""
    try:
        # Build query for population data
        query = db.query(
            County.fips,
            County.name.label("county_name"),
            County.geometry,
            Population.population
        ).outerjoin(  # Use LEFT JOIN to include counties even if they don't have population data
            Population, and_(
                Population.fips == County.fips,
                Population.year == year
            )
        ).filter(
            ~County.fips.startswith('72')  # Exclude Puerto Rico
        )
        
        results = query.all()
        features = []
        
        for row in results:
            if not row.geometry:
                continue
                
            pop = row.population or 0
            
            # Ensure valid number
            if pop is None or not math.isfinite(pop):
                pop = 0
            
            feature = {
                "type": "Feature",
                "geometry": row.geometry,
                "properties": {
                    "fips": row.fips,
                    "county_name": row.county_name,
                    "value": int(pop),
                    "population": int(pop)
                }
            }
            features.append(feature)
        
        return {
            "type": "FeatureCollection",
            "features": features,
            "metadata": {
                "time_scale": "yearly",
                "year": year,
                "metric": "population",
                "feature_count": len(features)
            }
        }
        
    except Exception as e:
        logger.error(f"Error in population choropleth: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# Register the router
app.include_router(choropleth_router)

@app.get("/api/pm25/bar_chart/{fips}")
async def get_bar_chart_data(
    fips: str,
    time_scale: str = Query("yearly", pattern="^(yearly|monthly|seasonal|daily)$"),
    start_year: Optional[int] = Query(None),
    end_year: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    season: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Get preprocessed bar chart data for a specific county.
    Uses summary tables when possible for better performance.
    
    Returns a list of data points with the following structure:
    [
      {
        "year": int,               # Year of the data point
        "month": Optional[int],    # Month (1-12) if time_scale is monthly
        "season": Optional[str],   # Season name if time_scale is seasonal
        "date": Optional[str],     # ISO date string if time_scale is daily
        "total": float,           # Total PM2.5 value
        "fire": float,            # Fire-related PM2.5
        "nonfire": float          # Non-fire PM2.5
      },
      ...
    ]
    """
    try:
        # Validate county exists
        county = db.query(County).filter(County.fips == fips).first()
        if not county:
            raise HTTPException(status_code=404, detail=f"County with FIPS {fips} not found")
        
        if time_scale == "yearly":
            query = db.query(YearlyPM25Summary).filter(YearlyPM25Summary.fips == fips)
            
            if start_year and end_year:
                query = query.filter(
                    YearlyPM25Summary.year >= start_year,
                    YearlyPM25Summary.year <= end_year
                )
            elif year:
                query = query.filter(YearlyPM25Summary.year == year)
            
            results = query.order_by(YearlyPM25Summary.year).all()
            
            data = [
                {
                    "year": r.year,
                    "total": float(r.avg_total),
                    "fire": float(r.avg_fire),
                    "nonfire": float(r.avg_nonfire),
                    "max_total": float(r.max_total),
                    "max_fire": float(r.max_fire),
                    "days_count": r.days_count
                }
                for r in results
            ]
            
        elif time_scale == "monthly":
            if not year:
                raise HTTPException(status_code=400, detail="Year required for monthly data")
            
            results = db.query(MonthlyPM25Summary).filter(
                MonthlyPM25Summary.fips == fips,
                MonthlyPM25Summary.year == year
            ).order_by(MonthlyPM25Summary.month).all()
            
            data = [
                {
                    "year": r.year,
                    "month": r.month,
                    "total": float(r.avg_total),
                    "fire": float(r.avg_fire),
                    "nonfire": float(r.avg_nonfire),
                    "max_total": float(r.max_total),
                    "max_fire": float(r.max_fire),
                    "days_count": r.days_count
                }
                for r in results
            ]
            
        elif time_scale == "seasonal":
            query = db.query(SeasonalPM25Summary).filter(SeasonalPM25Summary.fips == fips)
            
            if start_year and end_year:
                query = query.filter(
                    SeasonalPM25Summary.year >= start_year,
                    SeasonalPM25Summary.year <= end_year
                )
            elif year:
                query = query.filter(SeasonalPM25Summary.year == year)
            
            results = query.order_by(SeasonalPM25Summary.year, SeasonalPM25Summary.season).all()
            
            data = [
                {
                    "year": r.year,
                    "season": r.season,
                    "total": float(r.avg_total),
                    "fire": float(r.avg_fire),
                    "nonfire": float(r.avg_nonfire),
                    "max_total": float(r.max_total),
                    "max_fire": float(r.max_fire),
                    "days_count": r.days_count
                }
                for r in results
            ]
            
        elif time_scale == "daily":
            # For daily data, use the original DailyPM25 table
            if not year:
                raise HTTPException(status_code=400, detail="Year required for daily data")
            
            # Helper function to get season from month
            def get_season_from_month(month_num):
                if month_num in [12, 1, 2]:
                    return 'winter'
                elif month_num in [3, 4, 5]:
                    return 'spring'
                elif month_num in [6, 7, 8]:
                    return 'summer'
                else:  # 9, 10, 11
                    return 'fall'
            
            # Build the date range based on month or season
            if month:
                # Get daily data for specific month
                if month < 1 or month > 12:
                    raise HTTPException(status_code=400, detail="Month must be between 1 and 12")
                
                # Calculate last day of month
                if month == 12:
                    next_month = 1
                    next_year = year + 1
                else:
                    next_month = month + 1
                    next_year = year
                
                start_date = date(year, month, 1)
                end_date = date(next_year, next_month, 1)  # First day of next month
                
            elif season:
                # Get daily data for specific season
                season = season.lower()
                if season not in ['winter', 'spring', 'summer', 'fall']:
                    raise HTTPException(status_code=400, detail="Season must be winter, spring, summer, or fall")
                
                if season == 'winter':
                    # Winter: Dec 21 - Mar 20
                    start_date = date(year - 1, 12, 21)
                    end_date = date(year, 3, 21)
                elif season == 'spring':
                    # Spring: Mar 21 - Jun 20
                    start_date = date(year, 3, 21)
                    end_date = date(year, 6, 21)
                elif season == 'summer':
                    # Summer: Jun 21 - Sep 20
                    start_date = date(year, 6, 21)
                    end_date = date(year, 9, 21)
                elif season == 'fall':
                    # Fall: Sep 21 - Dec 20
                    start_date = date(year, 9, 21)
                    end_date = date(year, 12, 21)
            else:
                # Get all daily data for the year
                start_date = date(year, 1, 1)
                end_date = date(year + 1, 1, 1)  # First day of next year
            
            results = db.query(DailyPM25).filter(
                DailyPM25.fips == fips,
                DailyPM25.date >= start_date,
                DailyPM25.date < end_date
            ).order_by(DailyPM25.date).all()
            
            data = [
                {
                    "date": r.date.isoformat(),
                    "year": r.date.year,
                    "month": r.date.month,
                    "day": r.date.day,
                    "total": float(r.total),
                    "fire": float(r.fire),
                    "nonfire": float(r.nonfire)
                }
                for r in results
            ]
        
        return data
        
    except Exception as e:
        logger.error(f"Error in bar chart data: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/counties/statistics")
async def get_county_statistics(
    time_scale: str = Query("yearly", pattern="^(yearly|monthly|seasonal)$"),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    season: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Get statistical summaries across all counties."""
    try:
        if time_scale == "yearly":
            if not year:
                raise HTTPException(status_code=400, detail="Year required for yearly statistics")
            
            stats = db.query(
                func.avg(YearlyPM25Summary.avg_total).label("mean_total"),
                func.avg(YearlyPM25Summary.avg_fire).label("mean_fire"),
                func.avg(YearlyPM25Summary.avg_nonfire).label("mean_nonfire"),
                func.percentile_cont(0.5).within_group(YearlyPM25Summary.avg_total).label("median_total"),
                func.percentile_cont(0.5).within_group(YearlyPM25Summary.avg_fire).label("median_fire"),
                func.min(YearlyPM25Summary.avg_total).label("min_total"),
                func.max(YearlyPM25Summary.avg_total).label("max_total"),
                func.count().label("county_count")
            ).filter(YearlyPM25Summary.year == year).first()
            
        elif time_scale == "monthly":
            if not year or not month:
                raise HTTPException(status_code=400, detail="Year and month required for monthly statistics")
            
            stats = db.query(
                func.avg(MonthlyPM25Summary.avg_total).label("mean_total"),
                func.avg(MonthlyPM25Summary.avg_fire).label("mean_fire"),
                func.avg(MonthlyPM25Summary.avg_nonfire).label("mean_nonfire"),
                func.percentile_cont(0.5).within_group(MonthlyPM25Summary.avg_total).label("median_total"),
                func.percentile_cont(0.5).within_group(MonthlyPM25Summary.avg_fire).label("median_fire"),
                func.min(MonthlyPM25Summary.avg_total).label("min_total"),
                func.max(MonthlyPM25Summary.avg_total).label("max_total"),
                func.count().label("county_count")
            ).filter(
                MonthlyPM25Summary.year == year,
                MonthlyPM25Summary.month == month
            ).first()
            
        elif time_scale == "seasonal":
            if not year or not season:
                raise HTTPException(status_code=400, detail="Year and season required for seasonal statistics")
            
            stats = db.query(
                func.avg(SeasonalPM25Summary.avg_total).label("mean_total"),
                func.avg(SeasonalPM25Summary.avg_fire).label("mean_fire"),
                func.avg(SeasonalPM25Summary.avg_nonfire).label("mean_nonfire"),
                func.percentile_cont(0.5).within_group(SeasonalPM25Summary.avg_total).label("median_total"),
                func.percentile_cont(0.5).within_group(SeasonalPM25Summary.avg_fire).label("median_fire"),
                func.min(SeasonalPM25Summary.avg_total).label("min_total"),
                func.max(SeasonalPM25Summary.avg_total).label("max_total"),
                func.count().label("county_count")
            ).filter(
                SeasonalPM25Summary.year == year,
                SeasonalPM25Summary.season == season.lower()
            ).first()
        
        return {
            "time_scale": time_scale,
            "year": year,
            "month": month,
            "season": season,
            "statistics": {
                "mean_total_pm25": float(stats.mean_total) if stats.mean_total else 0,
                "mean_fire_pm25": float(stats.mean_fire) if stats.mean_fire else 0,
                "mean_nonfire_pm25": float(stats.mean_nonfire) if stats.mean_nonfire else 0,
                "median_total_pm25": float(stats.median_total) if stats.median_total else 0,
                "median_fire_pm25": float(stats.median_fire) if stats.median_fire else 0,
                "min_total_pm25": float(stats.min_total) if stats.min_total else 0,
                "max_total_pm25": float(stats.max_total) if stats.max_total else 0,
                "county_count": int(stats.county_count) if stats.county_count else 0
            }
        }
        
    except Exception as e:
        logger.error(f"Error in statistics: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/mortality_impact")
def get_mortality_impact(
    year: int = Query(None, description="Year to filter (optional)"),
    fips: str = Query(None, description="County FIPS code to filter (optional)"),
    db: Session = Depends(get_db)
):
    """
    Compute GEMM-based excess mortality for each county-year using:
    ΔMortality = Population × y₀ × (exp(β × PM₂.₅) - 1)
    Joins yearly_pm25_summary, population, and baseline_mortality_rate.
    """
    beta = 0.0058
    try:
        # Build base query
        query = db.query(
            YearlyPM25Summary.fips,
            County.name.label("county_name"),
            YearlyPM25Summary.year,
            YearlyPM25Summary.avg_total.label("pm25"),
            Population.population,
            func.avg(BaselineMortalityRate.value).label("y0_avg")
        ).join(
            County, County.fips == YearlyPM25Summary.fips
        ).join(
            Population, and_(
                Population.fips == YearlyPM25Summary.fips,
                Population.year == YearlyPM25Summary.year
            )
        ).join(
            BaselineMortalityRate, and_(
                BaselineMortalityRate.fips == YearlyPM25Summary.fips,
                BaselineMortalityRate.year == YearlyPM25Summary.year,
                BaselineMortalityRate.stat_type == '1',
                BaselineMortalityRate.source == 'basemor_ALL'
            )
        ).group_by(
            YearlyPM25Summary.fips,
            County.name,
            YearlyPM25Summary.year,
            YearlyPM25Summary.avg_total,
            Population.population
        )

        if year:
            query = query.filter(YearlyPM25Summary.year == year)
        if fips:
            query = query.filter(YearlyPM25Summary.fips == fips)

        results = []
        for row in query.all():
            pm25 = row.pm25 or 0
            pop = row.population or 0
            y0 = row.y0_avg or 0

            # Ensure all are valid numbers
            if pm25 is None or not math.isfinite(pm25):
                pm25 = 0
            if pop is None or not math.isfinite(pop):
                pop = 0
            if y0 is None or not math.isfinite(y0):
                y0 = 0

            delta_mortality = pop * y0 * (np.exp(beta * pm25) - 1)
            if not math.isfinite(delta_mortality):
                delta_mortality = 0

            results.append({
                "fips": row.fips,
                "county_name": row.county_name,
                "year": row.year,
                "pm25": pm25,
                "population": pop,
                "y0": y0,
                "delta_mortality": delta_mortality
            })
        return results
    except Exception as e:
        print(e)
        logger.error(f"Error in health impact endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# Health check endpoint
@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

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
