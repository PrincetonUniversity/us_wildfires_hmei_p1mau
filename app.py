from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import geopandas as gpd
import pandas as pd
from pathlib import Path

# Initialize FastAPI app
app = FastAPI(title="PM2.5 Wildfire Dashboard")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for development
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"]   # Allows all headers
)

# Paths
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
PM25_CSV = 'data/pm25_analysis_by_county.csv'
COUNTIES_SHP = 'data/shapefiles/cb_2018_us_county_20m.shp'

# Create data directory if it doesn't exist
DATA_DIR.mkdir(exist_ok=True)

def load_data(pm25_csv_path=None, counties_shp_path=None):
    """Load and process PM2.5 and counties data
    
    Args:
        pm25_csv_path (str, optional): Path to PM2.5 CSV file. Defaults to None.
        counties_shp_path (str, optional): Path to counties shapefile. Defaults to None.
    """
    try:
        # Use provided paths or fall back to module-level constants
        pm25_path = pm25_csv_path or PM25_CSV
        counties_path = counties_shp_path or COUNTIES_SHP
        
        print(f"Loading PM2.5 data from: {pm25_path}")
        print(f"Loading counties shapefile from: {counties_path}")
        
        # Load PM2.5 data
        pm25 = pd.read_csv(pm25_path, encoding='utf-8-sig')
        print('CSV columns:', pm25.columns)
        counties = gpd.read_file(counties_path)

        # Load population data
        population = pd.read_csv('data/population_2021_2023.csv')
        print('Population data loaded')

        # --- Load FIPS lookup and merge ---
        fips_lookup = pd.read_csv('data/FIPScode.csv', header=None, names=['FIPS_code', 'county_name'])
        fips_lookup['FIPS_code'] = fips_lookup['FIPS_code'].astype(str).str.zfill(5)
        fips_lookup['county_index'] = fips_lookup.index + 1
        fips_lookup['county_index'] = fips_lookup['county_index'].astype(str)
        pm25['county_index'] = pm25['county_index'].astype(str)
        pm25 = pm25.merge(fips_lookup[['county_index', 'FIPS_code', 'county_name']], on='county_index', how='left')
        
        # Process population data
        population['county_index'] = population['county_index'].astype(str)
        population = population.merge(fips_lookup[['county_index', 'FIPS_code']], on='county_index', how='left')
        
        # Calculate average population, ignoring zeros
        population_avg = population.groupby('FIPS_code').apply(
            lambda x: x[x['population'] > 0]['population'].mean()
        ).reset_index(name='avg_population')
        
        # Ensure numeric and remove NA
        pm25['pm25'] = pd.to_numeric(pm25['pm25'], errors='coerce')
        pm25 = pm25.dropna(subset=['pm25'])
        pm25['FIPS_code'] = pm25['FIPS_code'].astype(str).str.zfill(5)
        counties['GEOID'] = counties['GEOID'].astype(str).str.zfill(5)

        # Process data for choropleth (average across tiers and years)
        total_pm25 = pm25[pm25['variable'] == 'total_pm25']
        fire_pm25 = pm25[pm25['variable'] == 'fire_pm25']
        
        # First average across tiers for each county/year
        county_year_avg_total = total_pm25.groupby(['FIPS_code', 'year'])['pm25'].mean().reset_index()
        county_year_avg_fire = fire_pm25.groupby(['FIPS_code', 'year'])['pm25'].sum().reset_index()
        
        # Then average across years for final choropleth values
        choropleth_data_total = county_year_avg_total.groupby('FIPS_code')['pm25'].mean().reset_index(name='avg_total_pm25')
        choropleth_data_fire = county_year_avg_fire.groupby('FIPS_code')['pm25'].mean().reset_index(name='fire_pm25')

        # Process data for bar charts
        # Get total PM2.5 (average across tiers)
        total_by_county_year = total_pm25.groupby(['FIPS_code', 'year'])['pm25'].mean().reset_index(name='total')
        
        # Get fire PM2.5 (sum across tiers)
        fire_by_county_year = fire_pm25.groupby(['FIPS_code', 'year'])['pm25'].sum().reset_index(name='fire')
        
        print('\nFire data sample before merge:')
        print(fire_by_county_year.head())
        
        # Merge and calculate nonfire
        bar_df = pd.merge(total_by_county_year, fire_by_county_year, on=['FIPS_code', 'year'], how='outer').fillna(0)
        
        print('\nMerged data sample:')
        print(bar_df.head())
        
        # Ensure all values are non-negative and reasonable
        bar_df['fire_raw'] = bar_df['fire']
        bar_df['fire'] = bar_df['fire'].clip(lower=0, upper=bar_df['total'])
        bar_df['nonfire'] = (bar_df['total'] - bar_df['fire']).clip(lower=0)
        
        # Debug print to check for anomalies
        print('\nData ranges:')
        print('Total PM2.5 range:', bar_df['total'].min(), 'to', bar_df['total'].max())
        print('Fire PM2.5 range:', bar_df['fire'].min(), 'to', bar_df['fire'].max())
        print('Non-fire PM2.5 range:', bar_df['nonfire'].min(), 'to', bar_df['nonfire'].max())
        
        # Debug print for Humboldt County (FIPS 06023)
        humboldt = bar_df[bar_df['FIPS_code'] == '06023']
        print('\nHumboldt County (FIPS 06023) bar_df:')
        print(humboldt[['year', 'total', 'fire_raw', 'fire', 'nonfire']])
        
        # Map year numbers to actual years
        year_map = {1: 2021, 2: 2022, 3: 2023}
        bar_df['year'] = bar_df['year'].map(year_map)
        
        # Pivot for easy merge with counties
        bar_pivot = bar_df.pivot(index='FIPS_code', columns='year')[['total', 'fire', 'nonfire']]
        bar_pivot.columns = [f'pm25_{col[1]}_{col[0]}' for col in bar_pivot.columns]
        bar_pivot = bar_pivot.reset_index()

        print('\nPivoted data sample:')
        print(bar_pivot.head())
        print('\nPivoted columns:', bar_pivot.columns.tolist())

        # Merge everything onto counties
        # First merge choropleth data
        counties = counties.merge(choropleth_data_total, left_on='GEOID', right_on='FIPS_code', how='left', suffixes=('', '_total'))
        counties = counties.merge(choropleth_data_fire, left_on='GEOID', right_on='FIPS_code', how='left', suffixes=('', '_fire'))
        
        # Then merge bar chart data
        counties = counties.merge(bar_pivot, left_on='GEOID', right_on='FIPS_code', how='left', suffixes=('', '_bar'))
        
        # Merge average population data
        counties = counties.merge(population_avg, left_on='GEOID', right_on='FIPS_code', how='left', suffixes=('', '_pop'))
        
        # Finally merge county names
        counties = counties.merge(fips_lookup[['FIPS_code', 'county_name']], left_on='GEOID', right_on='FIPS_code', how='left', suffixes=('', '_name'))
        
        # Clean up duplicate columns
        counties = counties.drop(columns=[col for col in counties.columns if col.endswith(('_bar', '_name'))])
        
        # Fill NA with 0 for frontend
        counties = counties.fillna(0)
        
        # Debug print to verify final data
        print('\nFinal sample county properties:')
        sample_county = counties.iloc[0].to_dict()
        print('Available columns:', counties.columns.tolist())
        print('PM2.5 data:', {k: v for k, v in sample_county.items() if k.startswith('pm25_')})
        
        # Verify all required columns are present
        required_columns = [
            'pm25_2021_total', 'pm25_2022_total', 'pm25_2023_total',
            'pm25_2021_fire', 'pm25_2022_fire', 'pm25_2023_fire',
            'pm25_2021_nonfire', 'pm25_2022_nonfire', 'pm25_2023_nonfire'
        ]
        missing_columns = [col for col in required_columns if col not in counties.columns]
        if missing_columns:
            print('\nWARNING: Missing required columns:', missing_columns)
            # Add missing columns with 0 values
            for col in missing_columns:
                counties[col] = 0
            print('Added missing columns with 0 values')
        
        return counties
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/counties")
async def get_counties():
    """Get GeoJSON data for all counties with PM2.5 data"""
    try:
        print("Loading data...")
        # Load and process the data
        df = load_data('data/pm25_data.csv', 'data/shapefiles/cb_2018_us_county_20m.shp')
        print(f"Data loaded successfully. Rows: {len(df)}")
        
        # Debug: print join keys and sample properties
        print('Sample counties GEOID:', df['GEOID'].head())
        if 'county_index' in df.columns:
            print('Sample counties county_index:', df['county_index'].head())
        print('Sample county properties:', df.iloc[0].to_dict())

        # Convert to GeoJSON
        gdf = gpd.GeoDataFrame(df)
        print("Converted to GeoDataFrame")
        
        # Convert to GeoJSON format
        features = []
        for feature, props in zip(
            gdf.__geo_interface__["features"],
            gdf.drop(columns="geometry").to_dict("records")
        ):
            try:
                features.append({
                    "type": "Feature",
                    "geometry": feature["geometry"],
                    "properties": props
                })
            except Exception as feat_err:
                print(f"Error processing feature: {feat_err}")
                continue
                
        print(f"Successfully processed {len(features)} features")
        return {
            "type": "FeatureCollection",
            "features": features
        }
    except Exception as e:
        import traceback
        error_details = f"{str(e)}\n\n{traceback.format_exc()}"
        print(f"Error in get_counties: {error_details}")
        raise HTTPException(status_code=500, detail=error_details)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def read_root():
    """Serve the main HTML file"""
    return FileResponse("static/index.html")

if __name__ == '__main__':
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
