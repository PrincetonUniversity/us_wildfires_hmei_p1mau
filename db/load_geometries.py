import os
import json
import geopandas as gpd
from sqlalchemy import text
from .database import SessionLocal

def load_county_geometries(shapefile_path=None):
    """
    Load county geometries from a shapefile into the database.
    
    Args:
        shapefile_path (str, optional): Path to shapefile directory. If not provided,
            looks for shapefile in the default location.
    """
    if shapefile_path is None:
        shapefile_path = "/Users/hassankhan/Desktop/HMEI/Project/web_interface/data/shapefiles/cb_2018_us_county_20m.shp"
    
    if not os.path.exists(shapefile_path):
        print(f"Error: Shapefile not found at {shapefile_path}")
        print("Please provide a valid path to the shapefile.")
        return
    
    print(f"Loading county geometries from {shapefile_path}...")
    
    try:
        # Read the shapefile
        gdf = gpd.read_file(shapefile_path)
        
        # Convert to WGS84 (EPSG:4326) if needed
        if gdf.crs and gdf.crs.to_epsg() != 4326:
            gdf = gdf.to_crs(epsg=4326)
        
        # Create FIPS code by combining STATEFP and COUNTYFP
        gdf['FIPS'] = gdf['STATEFP'] + gdf['COUNTYFP']
        
        # Convert to GeoJSON and prepare for database
        gdf['geometry'] = gdf['geometry'].apply(lambda x: json.loads(gpd.GeoSeries([x]).to_json())['features'][0]['geometry'])
        
        # Connect to database
        db = SessionLocal()
        
        # Prepare data for batch insert
        records = []
        for _, row in gdf.iterrows():
            records.append({
                'fips': row['FIPS'],
                'geometry': json.dumps(row['geometry'])
            })
        
        # Update database in batches
        batch_size = 100
        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            for record in batch:
                # Convert geometry to JSON string if it's a dict
                geometry = record['geometry']
                if isinstance(geometry, dict):
                    geometry = json.dumps(geometry)
                
                # Execute update with proper parameter binding
                db.execute(
                    text("""
                    UPDATE counties 
                    SET geometry = :geometry
                    WHERE fips = :fips
                    """),
                    {'geometry': geometry, 'fips': record['fips']}
                )
            db.commit()
            print(f"Processed {min(i + batch_size, len(records))}/{len(records)} records...")
        
        print(f"Successfully updated geometries for {len(records)} counties.")
        
    except Exception as e:
        print(f"Error: {str(e)}")
        if 'db' in locals():
            db.rollback()
        raise
    finally:
        if 'db' in locals():
            db.close()

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Load county geometries from shapefile into the database.')
    parser.add_argument('--file', type=str, help='Path to shapefile (.shp)')
    args = parser.parse_args()
    
    load_county_geometries(args.file)

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Load county geometries from GeoJSON into the database.')
    parser.add_argument('--file', type=str, help='Path to GeoJSON file')
    args = parser.parse_args()
    
    load_county_geometries(args.file)
