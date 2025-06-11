from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import geopandas as gpd
import pandas as pd
from pathlib import Path
from datetime import datetime
from typing import Optional
import numpy as np

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
PM25_ANALYSIS_CSV = '/Users/hassankhan/Desktop/HMEI/Project/data/pm25_analysis_by_county.csv'
PM25_DATA_CSV = '/Users/hassankhan/Desktop/HMEI/Project/data/pm25_data.csv'
COUNTIES_SHP = '/Users/hassankhan/Desktop/HMEI/Project/data/shapefiles/cb_2018_us_county_20m.shp'
POPULATION_CSV = '/Users/hassankhan/Desktop/HMEI/Project/data/population_2021_2023.csv'
FIPS_CSV = '/Users/hassankhan/Desktop/HMEI/Project/data/FIPScode.csv'

# Create data directory if it doesn't exist
# DATA_DIR.mkdir(exist_ok=True)

def load_data(pm25_csv_path=None, counties_shp_path=None):
    """Load and process PM2.5 and counties data
    
    Args:
        pm25_csv_path (str, optional): Path to PM2.5 CSV file. Defaults to None.
        counties_shp_path (str, optional): Path to counties shapefile. Defaults to None.
    """
    try:
        # Use provided paths or fall back to module-level constants
        pm25_path = pm25_csv_path or PM25_DATA_CSV
        counties_path = counties_shp_path or COUNTIES_SHP
        
        print(f"Loading PM2.5 data from: {pm25_path}")
        print(f"Loading counties shapefile from: {counties_path}")
        
        # Load PM2.5 data
        pm25 = pd.read_csv(pm25_path, encoding='utf-8-sig')
        counties = gpd.read_file(counties_path)

        # Load population data
        population = pd.read_csv(POPULATION_CSV)
        print('Population data loaded')

        # --- Load FIPS lookup and merge ---
        fips_lookup = pd.read_csv(FIPS_CSV, header=None, names=['FIPS_code', 'county_name'])
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
        
        # Merge and calculate nonfire
        bar_df = pd.merge(total_by_county_year, fire_by_county_year, on=['FIPS_code', 'year'], how='outer').fillna(0)
        
        # Ensure all values are non-negative and reasonable
        bar_df['fire_raw'] = bar_df['fire']
        bar_df['fire'] = bar_df['fire'].clip(lower=0, upper=bar_df['total'])
        bar_df['nonfire'] = (bar_df['total'] - bar_df['fire']).clip(lower=0)
        
        # Map year numbers to actual years
        year_map = {1: 2021, 2: 2022, 3: 2023}
        bar_df['year'] = bar_df['year'].map(year_map)
        
        # Pivot for easy merge with counties
        bar_pivot = bar_df.pivot(index='FIPS_code', columns='year')[['total', 'fire', 'nonfire']]
        bar_pivot.columns = [f'pm25_{col[1]}_{col[0]}' for col in bar_pivot.columns]
        bar_pivot = bar_pivot.reset_index()

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
async def get_counties(
    start_date: Optional[str] = Query(None, description="Start date in YYYY-MM-DD format"),
    end_date: Optional[str] = Query(None, description="End date in YYYY-MM-DD format"),
    time_scale: Optional[str] = Query('period', description="Time scale: daily, monthly, seasonal, yearly, or period")
):
    """Get GeoJSON data for all counties with PM2.5 data"""
    try:
        print("Loading data...")
        # Load and process the data
        df = load_data(PM25_DATA_CSV, COUNTIES_SHP)
        print(f"Data loaded successfully. Rows: {len(df)}")
        
        # If date range is specified, load and process daily data
        if start_date and end_date:
            try:
                print(f"Loading daily data for range: {start_date} to {end_date}")
                # Read CSV with proper handling of line breaks in headers
                daily_data = pd.read_csv(
                    '/Users/hassankhan/Desktop/HMEI/Project/data/daily_county_data_combined.csv',
                    on_bad_lines='skip'  # Skip problematic lines
                )
                
                # Drop rows where all values are NA
                daily_data = daily_data.dropna(how='all')
                
                print(f"Daily data loaded. Columns: {daily_data.columns.tolist()}")
                print(f"Total rows in daily data: {len(daily_data)}")
                
                # Convert date columns to datetime
                daily_data['date'] = pd.to_datetime(daily_data[['Year', 'Month', 'Day']], errors='coerce')
                daily_data = daily_data.dropna(subset=['date'])  # Drop rows with invalid dates
                
                print(f"Date range in data: {daily_data['date'].min()} to {daily_data['date'].max()}")
                print(f"Rows after date conversion: {len(daily_data)}")
                
                # Handle different time scales
                if time_scale == 'monthly':
                    # For monthly data, we need to adjust the date range based on the month
                    start_date = pd.to_datetime(start_date)
                    month = start_date.month
                    year = start_date.year
                    
                    # Set start to first day of month
                    start_date = pd.Timestamp(year, month, 1)
                    
                    # Set end to last day of month (handling different month lengths)
                    if month == 12:
                        end_date = pd.Timestamp(year + 1, 1, 1) - pd.Timedelta(days=1)
                    else:
                        end_date = pd.Timestamp(year, month + 1, 1) - pd.Timedelta(days=1)
                    
                    print(f"Adjusted date range for month: {start_date} to {end_date}")
                
                elif time_scale == 'seasonal':
                    # For seasonal data, we need to adjust the date range based on the season
                    start_date = pd.to_datetime(start_date)
                    season = start_date.month
                    year = start_date.year
                    
                    # Define season ranges
                    if season == 11:  # Winter (Dec-Feb)
                        start_date = pd.Timestamp(year, 12, 1)
                        end_date = pd.Timestamp(year + 1, 2, 28)
                    elif season == 2:  # Spring (Mar-May)
                        start_date = pd.Timestamp(year, 3, 1)
                        end_date = pd.Timestamp(year, 5, 31)
                    elif season == 5:  # Summer (Jun-Aug)
                        start_date = pd.Timestamp(year, 6, 1)
                        end_date = pd.Timestamp(year, 8, 31)
                    else:  # Fall (Sep-Nov)
                        start_date = pd.Timestamp(year, 9, 1)
                        end_date = pd.Timestamp(year, 11, 30)
                    
                    print(f"Adjusted date range for season: {start_date} to {end_date}")
                
                # Filter by date range
                mask = (daily_data['date'] >= start_date) & (daily_data['date'] <= end_date)
                daily_data = daily_data[mask]
                print(f"Filtered data rows: {len(daily_data)}")
                print(f"Sample of filtered data:\n{daily_data[['FIPS', 'Value']].head()}")
                
                # Ensure FIPS codes are strings and properly formatted
                daily_data['FIPS'] = daily_data['FIPS'].astype(str).str.zfill(5)
                df['GEOID'] = df['GEOID'].astype(str).str.zfill(5)
                
                # Calculate averages based on time scale
                print(f"Calculating averages for time scale: {time_scale}")
                if time_scale == 'daily':
                    # For daily view, just use the single day's data
                    daily_avg = daily_data.groupby('FIPS').agg({
                        'Value': 'mean'
                    }).reset_index()
                    # Set both fire and nonfire PM2.5 to 0
                    daily_avg['fire_pm25'] = 0
                    daily_avg['nonfire_pm25'] = 0
                    print(f"Daily averages calculated for {len(daily_avg)} counties")
                    print(f"Sample daily averages:\n{daily_avg.head()}")
                    print(f"Value ranges in daily averages:")
                    print(f"Total PM2.5: {daily_avg['Value'].min():.2f} to {daily_avg['Value'].max():.2f}")
                    
                elif time_scale == 'monthly':
                    # For monthly view, group by FIPS and calculate monthly averages
                    daily_avg = daily_data.groupby('FIPS').agg({
                        'Value': 'mean'
                    }).reset_index()
                    daily_avg['fire_pm25'] = 0
                    daily_avg['nonfire_pm25'] = 0
                    print(f"Monthly averages calculated for {len(daily_avg)} counties")
                    
                elif time_scale == 'seasonal':
                    # For seasonal view, group by FIPS and calculate seasonal averages
                    daily_avg = daily_data.groupby('FIPS').agg({
                        'Value': 'mean'
                    }).reset_index()
                    daily_avg['fire_pm25'] = 0
                    daily_avg['nonfire_pm25'] = 0
                    print(f"Seasonal averages calculated for {len(daily_avg)} counties")
                    
                elif time_scale == 'yearly':
                    # For yearly view, group by FIPS and calculate yearly averages
                    daily_avg = daily_data.groupby('FIPS').agg({
                        'Value': 'mean'
                    }).reset_index()
                    daily_avg['fire_pm25'] = 0
                    daily_avg['nonfire_pm25'] = 0
                    print(f"Yearly averages calculated for {len(daily_avg)} counties")
                    
                else:  # period
                    # For custom period, calculate averages for the entire period
                    daily_avg = daily_data.groupby('FIPS').agg({
                        'Value': 'mean'
                    }).reset_index()
                    daily_avg['fire_pm25'] = 0
                    daily_avg['nonfire_pm25'] = 0
                    print(f"Period averages calculated for {len(daily_avg)} counties")
                
                # Merge with the main dataframe
                print("Merging with main dataframe...")
                print(f"Counties before merge: {len(df)}")
                print(f"Daily averages before merge: {len(daily_avg)}")
                print(f"Sample of daily averages before merge:\n{daily_avg.head()}")
                print(f"Available columns in daily_avg: {daily_avg.columns.tolist()}")
                
                # First merge with original column names
                df = df.merge(daily_avg, left_on='GEOID', right_on='FIPS', how='left')
                print(f"Counties after merge: {len(df)}")
                print(f"Available columns after merge: {df.columns.tolist()}")
                
                # Check for column name conflicts and handle them
                value_col = 'Value_y' if 'Value_y' in df.columns else 'Value'
                fire_col = 'fire_pm25_y' if 'fire_pm25_y' in df.columns else 'fire_pm25'
                nonfire_col = 'nonfire_pm25_y' if 'nonfire_pm25_y' in df.columns else 'nonfire_pm25'
                
                print(f"Using columns: Value={value_col}, Fire={fire_col}, Nonfire={nonfire_col}")
                print(f"Sample of merged data:\n{df[['GEOID', value_col, fire_col, nonfire_col]].head()}")
                
                # Drop any existing avg_total_pm25 columns to avoid duplicates
                if 'avg_total_pm25' in df.columns:
                    df = df.drop(columns=['avg_total_pm25'])
                
                # Now rename the columns after the merge
                df = df.rename(columns={
                    value_col: 'avg_total_pm25',
                    fire_col: 'avg_fire_pm25',
                    nonfire_col: 'avg_nonfire_pm25'
                })
                
                # Update the PM2.5 values
                df['avg_total_pm25'] = df['avg_total_pm25'].fillna(0)
                df['fire_pm25'] = df['avg_fire_pm25'].fillna(0)
                df['nonfire_pm25'] = df['avg_nonfire_pm25'].fillna(0)
                
                # Clean up temporary columns
                columns_to_drop = ['FIPS']
                # Add any duplicate columns to drop
                for col in ['Value', 'Value_x', 'Value_y', 'fire_pm25', 'fire_pm25_x', 'fire_pm25_y', 
                           'nonfire_pm25', 'nonfire_pm25_x', 'nonfire_pm25_y', 'avg_fire_pm25', 'avg_nonfire_pm25']:
                    if col in df.columns and col not in ['avg_total_pm25', 'fire_pm25', 'nonfire_pm25']:
                        columns_to_drop.append(col)
                
                df = df.drop(columns=columns_to_drop)
                
                print(f"Final columns: {df.columns.tolist()}")
                print(f"Final data sample:\n{df[['GEOID', 'avg_total_pm25', 'fire_pm25', 'nonfire_pm25']].head()}")
                
                # Convert to float before calculating min/max
                df['avg_total_pm25'] = pd.to_numeric(df['avg_total_pm25'], errors='coerce')
                df['fire_pm25'] = pd.to_numeric(df['fire_pm25'], errors='coerce')
                df['nonfire_pm25'] = pd.to_numeric(df['nonfire_pm25'], errors='coerce')
                
                print(f"Value ranges - Total PM2.5: {float(df['avg_total_pm25'].min()):.2f} to {float(df['avg_total_pm25'].max()):.2f}")
                print(f"Value ranges - Fire PM2.5: {float(df['fire_pm25'].min()):.2f} to {float(df['fire_pm25'].max()):.2f}")
                print(f"Value ranges - Non-fire PM2.5: {float(df['nonfire_pm25'].min()):.2f} to {float(df['nonfire_pm25'].max()):.2f}")
                
            except Exception as e:
                print(f"Error processing daily data: {str(e)}")
                import traceback
                print(f"Traceback: {traceback.format_exc()}")
                # Continue with average data if daily data processing fails
        
        # Convert to GeoJSON
        gdf = gpd.GeoDataFrame(df)
        
        # Handle NaN values in numeric columns
        numeric_columns = gdf.select_dtypes(include=['float64', 'int64']).columns
        for col in numeric_columns:
            gdf[col] = gdf[col].fillna(0)
        
        # Convert to GeoJSON format
        features = []
        for feature, props in zip(
            gdf.__geo_interface__["features"],
            gdf.drop(columns="geometry").to_dict("records")
        ):
            try:
                # Ensure all numeric values are valid
                for key, value in props.items():
                    if isinstance(value, float) and (pd.isna(value) or np.isinf(value)):
                        props[key] = 0
                
                features.append({
                    "type": "Feature",
                    "geometry": feature["geometry"],
                    "properties": props
                })
            except Exception as feat_err:
                print(f"Error processing feature: {feat_err}")
                continue
                
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
