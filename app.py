# app.py - PM2.5 Wildfire Dashboard
# By: Hassan Khan

# Standard library imports
import logging
import warnings
import os
import math
from datetime import datetime, date
from contextlib import asynccontextmanager
from typing import Optional
from concurrent.futures import ThreadPoolExecutor

# Third-party imports
import numpy as np
from fastapi import FastAPI, HTTPException, Query, Depends, status, BackgroundTasks, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, and_, extract
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
import geopandas as gpd
from shapely.geometry import mapping

# Local application imports
from db.database import SessionLocal
from db.models import (
    DailyPM25, County, Population,
    YearlyPM25Summary, MonthlyPM25Summary, SeasonalPM25Summary,
    ExcessMortalitySummary, ExceedanceSummary, DecompositionSummary
)

# Suppress warnings from GeoPandas
warnings.filterwarnings(
    'ignore', message='.*initial implementation of Parquet.*')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

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
            shapefile_path = "data/shapefiles/county/cb_2024_us_county_5m.shp"

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

            logger.info("Loaded %d county geometries", len(COUNTY_GEOMETRIES))

        except Exception as e:
            logger.error("Error loading county geometries: %s",
                         str(e), exc_info=True)
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
        logger.error("Database error: %s", str(e))
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

# --- Helper Functions for Choropleth Endpoints ---


def build_choropleth_query(db, time_scale, year, month, season, summary_model):
    if time_scale == "yearly":
        if not year:
            raise HTTPException(
                status_code=400, detail="Year required for yearly data")
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
                Population.year == year,
                Population.age_group == 0
            )
        ).filter(
            summary_model.year == year,
            ~County.fips.startswith('72')
        )
    elif time_scale == "monthly":
        if not year or not month:
            raise HTTPException(
                status_code=400, detail="Year and month required for monthly data")
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
                Population.year == year,
                Population.age_group == 0
            )
        ).filter(
            summary_model.year == year,
            summary_model.month == month,
            ~County.fips.startswith('72')
        )
    elif time_scale == "seasonal":
        if not year or not season:
            raise HTTPException(
                status_code=400, detail="Year and season required for seasonal data")
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
                Population.year == year,
                Population.age_group == 0
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
choropleth_router = APIRouter(
    prefix="/api/counties/choropleth", tags=["Choropleth"])

# Add a helper to sanitize float values for JSON


def safe_float(val):
    if val is None or not math.isfinite(val):
        return 0.0
    return float(val)


@choropleth_router.get("/mortality")
async def get_choropleth_mortality(
    year: int = Query(..., description="Year required for mortality data"),
    sub_metric: str = Query("total", pattern="^(total|fire|nonfire)$",
                            description="Which excess mortality to return: total, fire, or nonfire"),
    age_group: Optional[str] = Query(
        None, description="Comma-separated age group indices (e.g., '1,2,3') (optional, 1-18)"),
    db: Session = Depends(get_db)
):
    """Get mortality impact choropleth data (precomputed summary, total/fire/nonfire), optionally by age group(s)."""
    try:
        base_query = db.query(
            County.fips,
            County.name.label("county_name"),
            County.geometry,
            ExcessMortalitySummary.total_excess,
            ExcessMortalitySummary.fire_excess,
            ExcessMortalitySummary.nonfire_excess,
            ExcessMortalitySummary.population,
            ExcessMortalitySummary.age_group
        ).join(
            ExcessMortalitySummary, and_(
                ExcessMortalitySummary.fips == County.fips,
                ExcessMortalitySummary.year == year
            )
        ).filter(
            ~County.fips.startswith('72')
        )
        age_group_list = None
        if age_group is not None and age_group.strip() != '':
            age_group_list = [int(x) for x in age_group.split(
                ',') if x.strip().isdigit()]
        if age_group_list:
            # Sum over selected age groups for each county
            subq = db.query(
                ExcessMortalitySummary.fips,
                func.sum(ExcessMortalitySummary.total_excess).label(
                    "total_excess"),
                func.sum(ExcessMortalitySummary.fire_excess).label(
                    "fire_excess"),
                func.sum(ExcessMortalitySummary.nonfire_excess).label(
                    "nonfire_excess"),
                func.sum(ExcessMortalitySummary.population).label("population")
            ).filter(
                ExcessMortalitySummary.year == year,
                ExcessMortalitySummary.age_group.in_(age_group_list)
            ).group_by(ExcessMortalitySummary.fips).subquery()
            results = db.query(
                County.fips,
                County.name.label("county_name"),
                County.geometry,
                subq.c.total_excess,
                subq.c.fire_excess,
                subq.c.nonfire_excess,
                subq.c.population
            ).join(subq, subq.c.fips == County.fips).filter(~County.fips.startswith('72')).all()
        else:
            # Sum over all age groups for each county-year
            subq = db.query(
                ExcessMortalitySummary.fips,
                func.sum(ExcessMortalitySummary.total_excess).label(
                    "total_excess"),
                func.sum(ExcessMortalitySummary.fire_excess).label(
                    "fire_excess"),
                func.sum(ExcessMortalitySummary.nonfire_excess).label(
                    "nonfire_excess"),
                func.sum(ExcessMortalitySummary.population).label("population")
            ).filter(
                ExcessMortalitySummary.year == year
            ).group_by(ExcessMortalitySummary.fips).subquery()
            results = db.query(
                County.fips,
                County.name.label("county_name"),
                County.geometry,
                subq.c.total_excess,
                subq.c.fire_excess,
                subq.c.nonfire_excess,
                subq.c.population
            ).join(subq, subq.c.fips == County.fips).filter(~County.fips.startswith('72')).all()

        def safe_float(value):
            """Convert value to float, handling None and NaN cases"""
            if value is None:
                return 0.0
            try:
                result = float(value)
                # Check if result is NaN or infinite
                if math.isnan(result) or math.isinf(result):
                    return 0.0
                return result
            except (ValueError, TypeError):
                return 0.0

        features = []
        for row in results:
            if not row.geometry:
                continue

            # Get the excess value based on sub_metric, with safe conversion
            if sub_metric == "total":
                excess = safe_float(row.total_excess)
            elif sub_metric == "fire":
                excess = safe_float(row.fire_excess)
            elif sub_metric == "nonfire":
                excess = safe_float(row.nonfire_excess)
            else:
                excess = safe_float(row.total_excess)

            population = row.population or 0

            # Safe calculation of the rate
            if population > 0 and excess is not None:
                value = (excess / population) * 100
                # Double-check the result isn't NaN
                if math.isnan(value) or math.isinf(value):
                    value = 0.0
            else:
                value = 0.0

            feature = {
                "type": "Feature",
                "geometry": row.geometry,
                "properties": {
                    "fips": row.fips,
                    "county_name": row.county_name,
                    "value": value,
                    "total_excess": safe_float(row.total_excess),
                    "fire_excess": safe_float(row.fire_excess),
                    "nonfire_excess": safe_float(row.nonfire_excess),
                    "population": int(row.population) if row.population is not None else 0
                }
            }
            features.append(feature)

        return {
            "type": "FeatureCollection",
            "features": features,
            "metadata": {
                "time_scale": "yearly",
                "year": year,
                "metric": f"excess_mortality_{sub_metric}",
                "feature_count": len(features),
                "age_group": age_group
            }
        }
    except Exception as e:
        logger.error("Error in mortality choropleth: %s",
                     str(e), exc_info=True)
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
    query = build_choropleth_query(
        db, time_scale, year, month, season, summary_model)
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
    query = build_choropleth_query(
        db, time_scale, year, month, season, summary_model)
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
    query = build_choropleth_query(
        db, time_scale, year, month, season, summary_model)
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
    year: Optional[int] = Query(
        2020, description="Year for population data (optional, defaults to 2020)"),
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
                Population.year == year,
                Population.age_group == 0  # Only total population
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
        logger.error("Error in population choropleth: %s",
                     str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@choropleth_router.get("/yll")
async def get_choropleth_yll(
    year: int = Query(..., description="Year required for YLL data"),
    sub_metric: str = Query("total", pattern="^(total|fire|nonfire)$",
                            description="Which YLL to return: total, fire, or nonfire"),
    age_group: Optional[str] = Query(
        None, description="Comma-separated age group indices (e.g., '1,2,3') (optional, 1-18)"),
    db: Session = Depends(get_db)
):
    """Get YLL impact choropleth data (precomputed summary, total/fire/nonfire), optionally by age group(s)."""

    try:
        age_group_list = None
        if age_group is not None and age_group.strip() != '':
            age_group_list = [int(x) for x in age_group.split(
                ',') if x.strip().isdigit()]

        if age_group_list:
            # Sum over selected age groups for each county
            subq = db.query(
                ExcessMortalitySummary.fips,
                func.sum(ExcessMortalitySummary.yll_total).label("yll_total"),
                func.sum(ExcessMortalitySummary.yll_fire).label("yll_fire"),
                func.sum(ExcessMortalitySummary.yll_nonfire).label(
                    "yll_nonfire"),
                func.sum(ExcessMortalitySummary.population).label("population")
            ).filter(
                ExcessMortalitySummary.year == year,
                ExcessMortalitySummary.age_group.in_(age_group_list)
            ).group_by(ExcessMortalitySummary.fips).subquery()
        else:
            # Sum over all age groups for each county-year
            subq = db.query(
                ExcessMortalitySummary.fips,
                func.sum(ExcessMortalitySummary.yll_total).label("yll_total"),
                func.sum(ExcessMortalitySummary.yll_fire).label("yll_fire"),
                func.sum(ExcessMortalitySummary.yll_nonfire).label(
                    "yll_nonfire"),
                func.sum(ExcessMortalitySummary.population).label("population")
            ).filter(
                ExcessMortalitySummary.year == year
            ).group_by(ExcessMortalitySummary.fips).subquery()

        results = db.query(
            County.fips,
            County.name.label("county_name"),
            County.geometry,
            subq.c.yll_total,
            subq.c.yll_fire,
            subq.c.yll_nonfire,
            subq.c.population
        ).join(subq, subq.c.fips == County.fips).filter(~County.fips.startswith('72')).all()

        features = []
        for row in results:
            if not row.geometry:
                continue

            # Get the YLL value based on sub_metric, with safe conversion
            if sub_metric == "total":
                yll_value = safe_float(row.yll_total)
            elif sub_metric == "fire":
                yll_value = safe_float(row.yll_fire)
            elif sub_metric == "nonfire":
                yll_value = safe_float(row.yll_nonfire)
            else:
                yll_value = 0.0

            total_pop = safe_float(row.population)

            # Normalize YLL: yll_value / total_pop
            normalized_yll = safe_float(
                yll_value / total_pop if total_pop > 0 else 0.0)

            feature = {
                "type": "Feature",
                "geometry": row.geometry,
                "properties": {
                    "fips": row.fips,
                    "county_name": row.county_name,
                    "yll_total": safe_float(row.yll_total),
                    "yll_fire": safe_float(row.yll_fire),
                    "yll_nonfire": safe_float(row.yll_nonfire),
                    "population": int(safe_float(total_pop)),
                    "value": normalized_yll
                }
            }
            features.append(feature)

        return {
            "type": "FeatureCollection",
            "features": features,
            "metadata": {
                "time_scale": "yearly",
                "year": year,
                "metric": f"yll_{sub_metric}",
                "feature_count": len(features),
                "age_group": age_group,
                "value_description": "normalized_yll_fraction"
            }
        }
    except Exception as e:
        logger.error("Error in YLL choropleth: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# Register the router
app.include_router(choropleth_router)


@app.get("/api/counties/decomp/{fips}")
def get_county_decomposition_info(
    fips: str,
    pm25_type: str = "total",
    db: Session = Depends(get_db)
):
    """
    Get decomposition summary and county info for a given county FIPS.
    Returns the latest available decomposition result.

    Args:
        fips (str): County FIPS code
        pm25_type (str): Type of PM2.5 analysis - 'total' or 'fire' (default: 'total')
    """
    # Validate pm25_type parameter
    if pm25_type not in ["total", "fire"]:
        raise HTTPException(
            status_code=400,
            detail="pm25_type must be 'total' or 'fire'"
        )

    county = db.query(County).filter(County.fips == fips).first()
    if not county:
        raise HTTPException(status_code=404, detail="County not found")

    # Map PM2.5 type to age_group code (using our workaround)
    age_group_code = -1 if pm25_type == "total" else -2

    # Query using age_group code instead of None
    decomp = db.query(DecompositionSummary)\
        .filter(
            DecompositionSummary.fips == fips,
            DecompositionSummary.age_group == age_group_code
    )\
        .order_by(DecompositionSummary.end_year.desc())\
        .first()

    if not decomp:
        pm25_desc = "total PM2.5" if pm25_type == "total" else "fire PM2.5"
        raise HTTPException(
            status_code=404,
            detail=f"Decomposition summary not found for this county ({pm25_desc})"
        )

    return {
        "fips": county.fips,
        "county_name": county.name,
        "pm25_type": pm25_type,
        "start_year": decomp.start_year,
        "end_year": decomp.end_year,
        "decomposition": {
            "population_growth": decomp.population_growth,
            "population_ageing": decomp.population_ageing,
            "baseline_mortality_change": decomp.baseline_mortality_change,
            "exposure_change": decomp.exposure_change,
            "total_change": decomp.total_change
        }
    }


@app.get("/api/pm25/bar_chart/{fips}")
async def get_bar_chart_data(
    fips: str,
    time_scale: str = Query(
        "yearly", pattern="^(yearly|monthly|seasonal|daily)$"),
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
            raise HTTPException(
                status_code=404, detail=f"County with FIPS {fips} not found")

        if time_scale == "yearly":
            query = db.query(YearlyPM25Summary).filter(
                YearlyPM25Summary.fips == fips)

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
                raise HTTPException(
                    status_code=400, detail="Year required for monthly data")

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
            query = db.query(SeasonalPM25Summary).filter(
                SeasonalPM25Summary.fips == fips)

            if start_year and end_year:
                query = query.filter(
                    SeasonalPM25Summary.year >= start_year,
                    SeasonalPM25Summary.year <= end_year
                )
            elif year:
                query = query.filter(SeasonalPM25Summary.year == year)

            results = query.order_by(
                SeasonalPM25Summary.year, SeasonalPM25Summary.season).all()

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
                raise HTTPException(
                    status_code=400, detail="Year required for daily data")

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
                    raise HTTPException(
                        status_code=400, detail="Month must be between 1 and 12")

                # Calculate last day of month
                if month == 12:
                    next_month = 1
                    next_year = year + 1
                else:
                    next_month = month + 1
                    next_year = year

                start_date = date(year, month, 1)
                # First day of next month
                end_date = date(next_year, next_month, 1)

            elif season:
                # Get daily data for specific season
                season = season.lower()
                if season not in ['winter', 'spring', 'summer', 'fall']:
                    raise HTTPException(
                        status_code=400, detail="Season must be winter, spring, summer, or fall")

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
        logger.error("Error in bar chart data: %s", str(e), exc_info=True)
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
                raise HTTPException(
                    status_code=400, detail="Year required for yearly statistics")

            stats = db.query(
                func.avg(YearlyPM25Summary.avg_total).label("mean_total"),
                func.avg(YearlyPM25Summary.avg_fire).label("mean_fire"),
                func.avg(YearlyPM25Summary.avg_nonfire).label("mean_nonfire"),
                func.percentile_cont(0.5).within_group(
                    YearlyPM25Summary.avg_total).label("median_total"),
                func.percentile_cont(0.5).within_group(
                    YearlyPM25Summary.avg_fire).label("median_fire"),
                func.min(YearlyPM25Summary.avg_total).label("min_total"),
                func.max(YearlyPM25Summary.avg_total).label("max_total"),
                func.count().label("county_count")
            ).filter(YearlyPM25Summary.year == year).first()

        elif time_scale == "monthly":
            if not year or not month:
                raise HTTPException(
                    status_code=400, detail="Year and month required for monthly statistics")

            stats = db.query(
                func.avg(MonthlyPM25Summary.avg_total).label("mean_total"),
                func.avg(MonthlyPM25Summary.avg_fire).label("mean_fire"),
                func.avg(MonthlyPM25Summary.avg_nonfire).label("mean_nonfire"),
                func.percentile_cont(0.5).within_group(
                    MonthlyPM25Summary.avg_total).label("median_total"),
                func.percentile_cont(0.5).within_group(
                    MonthlyPM25Summary.avg_fire).label("median_fire"),
                func.min(MonthlyPM25Summary.avg_total).label("min_total"),
                func.max(MonthlyPM25Summary.avg_total).label("max_total"),
                func.count().label("county_count")
            ).filter(
                MonthlyPM25Summary.year == year,
                MonthlyPM25Summary.month == month
            ).first()

        elif time_scale == "seasonal":
            if not year or not season:
                raise HTTPException(
                    status_code=400, detail="Year and season required for seasonal statistics")

            stats = db.query(
                func.avg(SeasonalPM25Summary.avg_total).label("mean_total"),
                func.avg(SeasonalPM25Summary.avg_fire).label("mean_fire"),
                func.avg(SeasonalPM25Summary.avg_nonfire).label(
                    "mean_nonfire"),
                func.percentile_cont(0.5).within_group(
                    SeasonalPM25Summary.avg_total).label("median_total"),
                func.percentile_cont(0.5).within_group(
                    SeasonalPM25Summary.avg_fire).label("median_fire"),
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
        logger.error("Error in statistics: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/excess_mortality")
def get_excess_mortality_summary(
    year: int = Query(None, description="Year to filter (optional)"),
    fips: str = Query(
        None, description="County FIPS code to filter (optional)"),
    sub_metric: str = Query("total", pattern="^(total|fire|nonfire)$",
                            description="Which excess mortality to return: total, fire, or nonfire"),
    age_group: Optional[str] = Query(
        None, description="Comma-separated age group indices (e.g., '1,2,3') (optional, 1-18)"),
    db: Session = Depends(get_db)
):
    """
    Return precomputed excess mortality summary (total, fire, nonfire) for each county-year-age_group. If age_group is not provided, return all age groups for the county-year.
    """
    try:
        age_group_list = None
        if age_group is not None and age_group.strip() != '':
            age_group_list = [int(x) for x in age_group.split(
                ',') if x.strip().isdigit()]
        # If fips is provided, group by year and sum over age groups
        if fips:
            query = db.query(
                ExcessMortalitySummary.year,
                func.sum(ExcessMortalitySummary.total_excess).label(
                    "total_excess"),
                func.sum(ExcessMortalitySummary.fire_excess).label(
                    "fire_excess"),
                func.sum(ExcessMortalitySummary.nonfire_excess).label(
                    "nonfire_excess"),
                func.sum(ExcessMortalitySummary.population).label("population")
            ).filter(ExcessMortalitySummary.fips == fips)
            if year:
                query = query.filter(ExcessMortalitySummary.year == year)
            if age_group_list:
                query = query.filter(
                    ExcessMortalitySummary.age_group.in_(age_group_list))
            query = query.group_by(ExcessMortalitySummary.year)
            results = []
            for row in query.all():
                if sub_metric == "total":
                    value = row.total_excess
                elif sub_metric == "fire":
                    value = row.fire_excess
                elif sub_metric == "nonfire":
                    value = row.nonfire_excess
                else:
                    value = row.total_excess
                results.append({
                    "year": row.year,
                    "population": int(row.population) if row.population is not None else 0,
                    "excess_mortality": float(value) if value is not None else 0.0,
                    "total_excess": float(row.total_excess) if row.total_excess is not None else 0.0,
                    "fire_excess": float(row.fire_excess) if row.fire_excess is not None else 0.0,
                    "nonfire_excess": float(row.nonfire_excess) if row.nonfire_excess is not None else 0.0
                })
            return results
        # Otherwise, return all age groups for the county-year (default behavior)
        query = db.query(ExcessMortalitySummary, County.name).join(
            County, County.fips == ExcessMortalitySummary.fips)
        if year:
            query = query.filter(ExcessMortalitySummary.year == year)
        if fips:
            query = query.filter(ExcessMortalitySummary.fips == fips)
        if age_group_list:
            query = query.filter(
                ExcessMortalitySummary.age_group == age_group_list)
        results = []
        for row, county_name in query.all():
            if sub_metric == "total":
                value = row.total_excess
            elif sub_metric == "fire":
                value = row.fire_excess
            elif sub_metric == "nonfire":
                value = row.nonfire_excess
            else:
                value = row.total_excess
            results.append({
                "fips": row.fips,
                "county_name": county_name,
                "year": row.year,
                "age_group": row.age_group,
                "population": int(row.population) if row.population is not None else 0,
                "excess_mortality": float(value) if value is not None else 0.0,
                "total_excess": float(row.total_excess) if row.total_excess is not None else 0.0,
                "fire_excess": float(row.fire_excess) if row.fire_excess is not None else 0.0,
                "nonfire_excess": float(row.nonfire_excess) if row.nonfire_excess is not None else 0.0
            })
        return results
    except Exception as e:
        logger.error(
            "Error in excess mortality summary endpoint: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/counties/exceedance")
def get_exceedance_summary(db: Session = Depends(get_db)):
    """
    Return exceedance summary for all counties as GeoJSON.
    """
    try:
        results = db.query(
            County.fips,
            County.name,
            County.geometry,
            ExceedanceSummary.threshold_8,
            ExceedanceSummary.threshold_9
        ).join(
            ExceedanceSummary, County.fips == ExceedanceSummary.fips
        ).all()

        features = []
        for row in results:
            features.append({
                "type": "Feature",
                "geometry": row.geometry,
                "properties": {
                    "fips": row.fips,
                    "county_name": row.name,
                    "threshold_8": row.threshold_8,
                    "threshold_9": row.threshold_9,
                }
            })
        return {
            "type": "FeatureCollection",
            "features": features,
            "metadata": {
                "description": "Exceedance summary for regulatory support",
                "thresholds": [8, 9],
                "tier_meanings": {
                    0: "Below the threshold",
                    1: "Exceeding due to fire smoke on Tier 1 days",
                    2: "Exceeding due to fire smoke on Tier 1&2 days",
                    3: "Exceeding due to fire smoke on Tier 1,2,3 days",
                    4: "Exceeding even after excluding fire smoke on all Tier 1,2,3 days"
                }
            }
        }
    except Exception as e:
        logger.error("Error in exceedance summary endpoint: %s",
                     str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# Health check endpoint


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

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
