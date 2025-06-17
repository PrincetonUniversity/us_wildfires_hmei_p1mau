from sqlalchemy import text
from .database import SessionLocal

def check_geometries():
    """Check if geometries were loaded correctly into the database."""
    db = SessionLocal()
    
    try:
        # Count total counties with geometries
        result = db.execute(text("""
            SELECT COUNT(*) as total_counties,
                   COUNT(geometry) as counties_with_geometry
            FROM counties
        
        """))
        
        counts = result.fetchone()
        print(f"Total counties: {counts[0]}")
        print(f"Counties with geometry: {counts[1]}")
        print(f"Percentage with geometry: {counts[1] / counts[0] * 100:.2f}%")
        
        # Get a sample of counties with geometry
        sample = db.execute(text("""
            SELECT fips, name, jsonb_typeof(geometry) as geom_type
            FROM counties
            WHERE geometry IS NOT NULL
            LIMIT 5
        
        """))
        
        print("\nSample of counties with geometry:")
        print("-" * 50)
        for row in sample:
            print(f"FIPS: {row[0]}, Name: {row[1]}, Geometry Type: {row[2]}")
            
    except Exception as e:
        print(f"Error checking geometries: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    check_geometries()
