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
BASE_DIR = '/Users/hassankhan/Desktop/HMEI/Project/'
DATA_DIR = BASE_DIR + "data/"
COUNTIES_SHP = DATA_DIR + "shapefiles/cb_2018_us_county_20m.shp"
POPULATION_CSV = DATA_DIR + "population_2021_2023.csv"
FIPS_CSV = DATA_DIR + "FIPScode.csv"
DAILY_DATA_CSV = DATA_DIR + "daily_county_data_combined.csv"

def load_data(pm25_csv_path=None, counties_shp_path=None):
    """Load and process PM2.5 and counties data
    
    Args:
        pm25_csv_path (str, optional): Path to PM2.5 CSV file. Defaults to None.
        counties_shp_path (str, optional): Path to counties shapefile. Defaults to None.
    """
    try:
        # Use provided path or fall back to module-level constant
        daily_path = pm25_csv_path or DAILY_DATA_CSV
        counties_path = counties_shp_path or COUNTIES_SHP
        
        print(f"Loading PM2.5 data from: {daily_path}")
        try:
            pm25 = pd.read_csv(daily_path, encoding='utf-8')
            counties = gpd.read_file(counties_path)
            print("PM2.5 and counties data loaded successfully")
        except Exception as e:
            print(f"Error loading data: {str(e)}")
            raise

        print("Loading population data...")
        population = pd.read_csv(POPULATION_CSV)
        print("Population data loaded")

        # Standardize column names to lowercase for easier access
        pm25.columns = [c.lower() for c in pm25.columns]
        
        # Ensure FIPS code is properly formatted and create FIPS_code column
        if 'fips' in pm25.columns:
            pm25['fips'] = pm25['fips'].astype(str).str.zfill(5)
            pm25['FIPS_code'] = pm25['fips']
        
        # Create date column from year, month, day
        if all(col in pm25.columns for col in ['year', 'month', 'day']):
            pm25['date'] = pd.to_datetime(pm25[['year', 'month', 'day']])
        
        # Load FIPS lookup for county names
        fips_lookup = pd.read_csv(FIPS_CSV, header=None, names=['FIPS_code', 'county_name'])
        fips_lookup['FIPS_code'] = fips_lookup['FIPS_code'].astype(str).str.zfill(5)
        
        # Process population data
        print("Processing population data...")
        # Ensure population data has FIPS_code column
        if 'FIPS_code' not in population.columns and 'fips' in population.columns:
            population['FIPS_code'] = population['fips'].astype(str).str.zfill(5)
        
        # If we still don't have FIPS_code, try to use county_index if it exists
        if 'FIPS_code' not in population.columns and 'county_index' in population.columns:
            # Create a mapping from county_index to FIPS_code from the pm25 data
            if 'countyindex' in pm25.columns and 'fips' in pm25.columns:
                index_to_fips = pm25.drop_duplicates('countyindex')[['countyindex', 'fips']]
                index_to_fips = index_to_fips.dropna()
                if not index_to_fips.empty:
                    population = population.merge(
                        index_to_fips.rename(columns={'fips': 'FIPS_code'}),
                        left_on='county_index',
                        right_on='countyindex',
                        how='left'
                    )
        
        # Ensure FIPS_code is properly formatted
        if 'FIPS_code' in population.columns:
            population['FIPS_code'] = population['FIPS_code'].astype(str).str.zfill(5)
            
        # Merge with county names
        if 'FIPS_code' in population.columns:
            population = population.merge(
                fips_lookup[['FIPS_code', 'county_name']],
                on='FIPS_code',
                how='left'
            )
        else:
            print("Warning: Could not determine FIPS codes for population data")
        
        # Calculate average population, ignoring zeros
        population_avg = (
            population[population['population'] > 0]
            .groupby('FIPS_code')['population']
            .mean()
            .reset_index(name='avg_population')
        )

        print("Processing daily data for choropleth and bar charts...")
        
        # Ensure FIPS/GEOID codes are properly formatted
        if 'FIPS_code' in pm25.columns:
            pm25['FIPS_code'] = pm25['FIPS_code'].astype(str).str.zfill(5)
        counties['GEOID'] = counties['GEOID'].astype(str).str.zfill(5)
        
        # Process the daily data for choropleth (average across all years)
        print("\nProcessing choropleth data...")
        choropleth_data = pm25.groupby('FIPS_code').agg({
            'value': 'mean',
            'fire_pm25': 'mean'
        }).reset_index()
        
        # Rename columns for consistency
        choropleth_data = choropleth_data.rename(columns={
            'value': 'avg_total_pm25',
            'fire_pm25': 'fire_pm25'
        })
        
        # Calculate nonfire PM2.5 for choropleth
        choropleth_data['nonfire_pm25'] = (choropleth_data['avg_total_pm25'] - choropleth_data['fire_pm25']).clip(lower=0)
        
        # Process data for bar charts (yearly averages)
        print("\nProcessing bar chart data...")
        print("Sample PM2.5 data before aggregation:")
        print(pm25[['FIPS_code', 'year', 'month', 'day', 'value', 'fire_pm25']].head())
        
        # Check for any non-zero values
        print("\nValue statistics:")
        print(f"Total rows: {len(pm25)}")
        print(f"Non-zero values: {(pm25['value'] > 0).sum()}")
        print(f"Non-zero fire_pm25: {(pm25['fire_pm25'] > 0).sum()}")
        print(f"Sample values: {pm25['value'].head().values}")
        print(f"Sample fire_pm25: {pm25['fire_pm25'].head().values}")
        
        # Ensure we have the required columns
        required_columns = ['FIPS_code', 'year', 'value', 'fire_pm25']
        missing_columns = [col for col in required_columns if col not in pm25.columns]
        if missing_columns:
            print(f"Warning: Missing required columns: {missing_columns}")
        
        # Group by FIPS and year, calculate mean values
        bar_df = pm25.groupby(['FIPS_code', 'year'], as_index=False).agg({
            'value': 'mean',
            'fire_pm25': 'mean'
        })
        
        print("\nAfter aggregation:")
        print(bar_df.head())
        print(f"\nColumns after aggregation: {bar_df.columns.tolist()}")
        
        # Calculate nonfire PM2.5 for bar chart
        bar_df['nonfire'] = (bar_df['value'] - bar_df['fire_pm25']).clip(lower=0)
        
        # Rename columns to match expected format
        bar_df = bar_df.rename(columns={
            'value': 'total',
            'fire_pm25': 'fire'
        })
        
        # Ensure values are non-negative
        bar_df['fire'] = bar_df['fire'].clip(lower=0)
        bar_df['total'] = bar_df['total'].clip(lower=0)
        bar_df['nonfire'] = (bar_df['total'] - bar_df['fire']).clip(lower=0)
        
        # Debug: Check the final values
        print("\nBar chart data statistics after processing:")
        print(f"Total PM2.5 mean: {bar_df['total'].mean()}")
        print(f"Fire PM2.5 mean: {bar_df['fire'].mean()}")
        print(f"Nonfire PM2.5 mean: {bar_df['nonfire'].mean()}")
        print("\nSample of final bar chart data:")
        print(bar_df.head())
        
        print("\nFinal bar chart data:")
        print(bar_df[['FIPS_code', 'year', 'total', 'fire', 'nonfire']].head())
        
        # Create choropleth data frames for merging
        choropleth_data_total = choropleth_data[['FIPS_code', 'avg_total_pm25']].copy()
        choropleth_data_fire = choropleth_data[['FIPS_code', 'fire_pm25']].copy()
        
        # Sort by year to ensure chronological order
        bar_df = bar_df.sort_values('year')
        print("Daily data processed successfully for all years (2013-2023)")
        
        print("Pivoting data for merging...")
        # Ensure year is integer to avoid decimal in column names
        bar_df['year'] = bar_df['year'].astype(int)
        
        # Pivot for easy merge with counties
        bar_pivot = bar_df.pivot(index='FIPS_code', columns='year')[['total', 'fire', 'nonfire']]
        # Debug: Print sample of pivoted data
        print("\nPivoted data sample (first 5 rows):")
        print(bar_pivot.head())
        
        # Ensure column names use integer years (no decimals)
        bar_pivot.columns = [f'pm25_{int(col[1])}_{col[0]}' for col in bar_pivot.columns]
        bar_pivot = bar_pivot.reset_index()

        print("\nColumn names after pivot:", bar_pivot.columns.tolist())
        print("Merging data with counties...")
        # Ensure consistent FIPS code format
        print("\nEnsuring consistent FIPS code format...")
        counties['GEOID'] = counties['GEOID'].astype(str).str.zfill(5)
        bar_pivot['FIPS_code'] = bar_pivot['FIPS_code'].astype(str).str.zfill(5)
        
        print("\nColumns in bar_pivot:", bar_pivot.columns.tolist())
        print("Sample of bar_pivot data:")
        print(bar_pivot.head())
        
        # Create a copy of counties to avoid modifying the original
        print("\nMerging bar chart data...")
        merged = counties.copy()
        
        # First, merge the bar chart data with the counties GeoDataFrame
        merged = merged.merge(
            bar_pivot,
            left_on='GEOID',
            right_on='FIPS_code',
            how='left',
            suffixes=('', '_bar')
        )
        
        print("\nAfter merging bar chart data:")
        print(f"Columns: {len(merged.columns)}")
        print("Sample PM2.5 columns:", [col for col in merged.columns if 'pm25_' in col][:10])
        
        # Then merge choropleth data
        print("\nMerging choropleth data...")
        merged = merged.merge(
            choropleth_data_total[['FIPS_code', 'avg_total_pm25']],
            left_on='GEOID',
            right_on='FIPS_code',
            how='left',
            suffixes=('', '_total')
        )
        
        merged = merged.merge(
            choropleth_data_fire[['FIPS_code', 'fire_pm25']],
            left_on='GEOID',
            right_on='FIPS_code',
            how='left',
            suffixes=('', '_fire')
        )
        
        # Merge average population data
        print("\nMerging population data...")
        merged = merged.merge(
            population_avg,
            left_on='GEOID',
            right_on='FIPS_code',
            how='left',
            suffixes=('', '_pop')
        )
        
        # Finally merge county names
        print("\nMerging county names...")
        merged = merged.merge(
            fips_lookup[['FIPS_code', 'county_name']],
            left_on='GEOID',
            right_on='FIPS_code',
            how='left',
            suffixes=('', '_name')
        )
        
        # Clean up duplicate columns carefully
        print("\nCleaning up duplicate columns...")
        columns_to_drop = []
        for suffix in ['_bar', '_name', '_pop', '_fire', '_total']:
            cols = [col for col in merged.columns if col.endswith(suffix) and col != 'FIPS_code']
            columns_to_drop.extend(cols)
        
        # Only drop columns that exist in the DataFrame
        columns_to_drop = [col for col in columns_to_drop if col in merged.columns]
        if columns_to_drop:
            print(f"Dropping columns: {columns_to_drop}")
            merged = merged.drop(columns=columns_to_drop)
        
        counties = merged
        
        # Debug: Check if we still have all PM2.5 columns
        pm25_cols = [col for col in counties.columns if 'pm25_' in col]
        print(f"\nFinal PM2.5 columns ({len(pm25_cols)} total):", pm25_cols)
        print("Sample values for first county:")
        sample = counties.iloc[0]
        for col in pm25_cols[:10]:  # Print first 10 PM2.5 columns
            print(f"{col}: {sample[col]}")
        
        # Fill NA with 0 for frontend
        counties = counties.fillna(0)
        
        # Debug: Print sample of data before final processing
        print("\nSample data before final processing (first county):")
        sample_fips = counties['GEOID'].iloc[0]
        sample_data = counties[counties['GEOID'] == sample_fips].iloc[0]
        
        # Print all PM2.5 related columns for the sample county
        pm25_cols = [col for col in counties.columns if 'pm25_' in col]
        for col in pm25_cols:
            print(f"{col}: {sample_data[col]}")
        
        # Ensure all PM2.5 columns are present and properly formatted
        for year in range(2013, 2024):
            for metric in ['total', 'fire', 'nonfire']:
                col = f'pm25_{year}_{metric}'
                if col not in counties.columns:
                    print(f"Warning: Column {col} not found, adding with zeros")
                    counties[col] = 0
                counties[col] = pd.to_numeric(counties[col], errors='coerce').fillna(0)
        
        # Debug: Print sample of data after processing
        print("\nSample data after processing (first county):")
        sample_data = counties[counties['GEOID'] == sample_fips].iloc[0]
        for col in pm25_cols:
            print(f"{col}: {sample_data[col]}")
        
        print("Data processing completed successfully")
        return counties
    except Exception as e:
        print(f"Error in load_data: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
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
        df = load_data(DAILY_DATA_CSV, COUNTIES_SHP)
        print(f"Data loaded successfully. Processing {len(df)} counties")
        
        # If date range is specified, load and process daily data
        if start_date and end_date:
            try:
                print(f"Loading daily data for range: {start_date} to {end_date}")
                # Read the daily data CSV
                daily_data = pd.read_csv(DAILY_DATA_CSV, on_bad_lines='skip')
                
                # Drop rows where all values are NA
                daily_data = daily_data.dropna(how='all')
                
                # Convert date columns to datetime
                try:
                    if 'Year' in daily_data.columns and 'Month' in daily_data.columns and 'Day' in daily_data.columns:
                        daily_data['date'] = pd.to_datetime(daily_data[['Year', 'Month', 'Day']], errors='coerce')
                        daily_data = daily_data.dropna(subset=['date'])  # Drop rows with invalid dates
                    else:
                        print("Warning: Required date columns not found in daily data")
                        daily_data = pd.DataFrame()  # Return empty DataFrame if columns are missing
                except Exception as e:
                    print(f"Error processing date columns: {str(e)}")
                    daily_data = pd.DataFrame()
                
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
                
                # Ensure FIPS codes are strings and properly formatted
                daily_data['FIPS'] = daily_data['FIPS'].astype(str).str.zfill(5)
                df['GEOID'] = df['GEOID'].astype(str).str.zfill(5)
                
                # Ensure fire_pm25 exists, if not create it with 0s
                if 'fire_pm25' not in daily_data.columns:
                    daily_data['fire_pm25'] = 0
                
                print(f"Calculating averages for time scale: {time_scale}")
                # Calculate averages based on time scale
                if time_scale == 'daily':
                    # For daily view, just use the single day's data
                    daily_avg = daily_data.groupby('FIPS').agg({
                        'Value': 'mean',
                        'fire_pm25': 'mean'
                    }).reset_index()
                    # Calculate nonfire PM2.5 as total - fire
                    daily_avg['nonfire_pm25'] = daily_avg['Value'] - daily_avg['fire_pm25']
                    # Ensure non-negative values
                    daily_avg['nonfire_pm25'] = daily_avg['nonfire_pm25'].clip(lower=0)
                    print("Daily averages calculated")
                    
                elif time_scale == 'monthly':
                    # For monthly view, group by FIPS and calculate monthly averages
                    daily_avg = daily_data.groupby('FIPS').agg({
                        'Value': 'mean',
                        'fire_pm25': 'mean'
                    }).reset_index()
                    # Calculate nonfire PM2.5 as total - fire
                    daily_avg['nonfire_pm25'] = daily_avg['Value'] - daily_avg['fire_pm25']
                    # Ensure non-negative values
                    daily_avg['nonfire_pm25'] = daily_avg['nonfire_pm25'].clip(lower=0)
                    print("Monthly averages calculated")
                    
                elif time_scale == 'seasonal':
                    # For seasonal view, group by FIPS and calculate seasonal averages
                    daily_avg = daily_data.groupby('FIPS').agg({
                        'Value': 'mean',
                        'fire_pm25': 'mean'
                    }).reset_index()
                    # Calculate nonfire PM2.5 as total - fire
                    daily_avg['nonfire_pm25'] = daily_avg['Value'] - daily_avg['fire_pm25']
                    # Ensure non-negative values
                    daily_avg['nonfire_pm25'] = daily_avg['nonfire_pm25'].clip(lower=0)
                    print("Seasonal averages calculated")
                    
                elif time_scale == 'yearly':
                    # For yearly view, group by FIPS and calculate yearly averages
                    daily_avg = daily_data.groupby('FIPS').agg({
                        'Value': 'mean',
                        'fire_pm25': 'mean'
                    }).reset_index()
                    # Calculate nonfire PM2.5 as total - fire
                    daily_avg['nonfire_pm25'] = daily_avg['Value'] - daily_avg['fire_pm25']
                    # Ensure non-negative values
                    daily_avg['nonfire_pm25'] = daily_avg['nonfire_pm25'].clip(lower=0)
                    print("Yearly averages calculated")
                    
                else:  # period
                    # For custom period, calculate averages for the entire period
                    daily_avg = daily_data.groupby('FIPS').agg({
                        'Value': 'mean',
                        'fire_pm25': 'mean'
                    }).reset_index()
                    # Calculate nonfire PM2.5 as total - fire
                    daily_avg['nonfire_pm25'] = daily_avg['Value'] - daily_avg['fire_pm25']
                    # Ensure non-negative values
                    daily_avg['nonfire_pm25'] = daily_avg['nonfire_pm25'].clip(lower=0)
                    print("Period averages calculated")
                
                print("Merging with main dataframe...")
                # First merge with original column names
                df = df.merge(daily_avg, left_on='GEOID', right_on='FIPS', how='left')
                
                # Check for column name conflicts and handle them
                value_col = 'Value_y' if 'Value_y' in df.columns else 'Value'
                fire_col = 'fire_pm25_y' if 'fire_pm25_y' in df.columns else 'fire_pm25'
                nonfire_col = 'nonfire_pm25_y' if 'nonfire_pm25_y' in df.columns else 'nonfire_pm25'
                
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
                
                # Convert to float before calculating min/max
                df['avg_total_pm25'] = pd.to_numeric(df['avg_total_pm25'], errors='coerce')
                df['fire_pm25'] = pd.to_numeric(df['fire_pm25'], errors='coerce')
                df['nonfire_pm25'] = pd.to_numeric(df['nonfire_pm25'], errors='coerce')
                
                print("Data processing completed successfully")
                
            except Exception as e:
                print(f"Error processing daily data: {str(e)}")
                import traceback
                print(f"Traceback: {traceback.format_exc()}")
                # Continue with average data if daily data processing fails
                pass
        
        print("Converting to GeoJSON...")
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
                
        print("GeoJSON conversion completed")
        return {
            "type": "FeatureCollection",
            "features": features
        }
    except Exception as e:
        print(f"Error in get_counties: {str(e)}")
        import traceback
        error_details = f"{str(e)}\n\n{traceback.format_exc()}"
        print(f"Traceback: {traceback.format_exc()}")
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
