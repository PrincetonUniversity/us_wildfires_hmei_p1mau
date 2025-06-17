import logging
from sqlalchemy import func, and_
from sqlalchemy.orm import Session
from .database import SessionLocal
from .models import County, DailyPM25, Population

def check_data():
    """Check the loaded data in the database."""
    db = SessionLocal()
    try:
        # Check counties
        county_count = db.query(County).count()
        print(f"\n=== Counties ===")
        print(f"Total counties: {county_count}")
        
        # Show first 5 counties
        print("\nSample counties:")
        for county in db.query(County).limit(5).all():
            print(f"  {county.fips}: {county.name} (index: {county.index})")
        
        # Check PM2.5 data
        pm25_count = db.query(DailyPM25).count()
        print(f"\n=== Daily PM2.5 Data ===")
        print(f"Total PM2.5 records: {pm25_count:,}")
        
        # Show date range and record count by year
        print("\nPM2.5 data by year:")
        year_counts = db.query(
            func.extract('year', DailyPM25.date).label('year'),
            func.count().label('count')
        ).group_by('year').order_by('year').all()
        
        for year, count in year_counts:
            print(f"  {int(year)}: {count:,} records")
        
        # Show sample PM2.5 data
        print("\nSample PM2.5 records:")
        for pm25 in db.query(DailyPM25).join(County).order_by(DailyPM25.date.desc()).limit(5).all():
            print(f"  {pm25.date}: {pm25.county.name} - "
                  f"Total: {pm25.total:.2f}, Fire: {pm25.fire:.2f}, Non-fire: {pm25.nonfire:.2f}")
        
        # Check population data
        pop_count = db.query(Population).count()
        print(f"\n=== Population Data ===")
        print(f"Total population records: {pop_count:,}")
        
        # Show population data by year
        print("\nPopulation data by year:")
        pop_years = db.query(
            Population.year,
            func.count().label('count')
        ).group_by(Population.year).order_by(Population.year).all()
        
        for year, count in pop_years:
            print(f"  {year}: {count:,} records")
        
        # Show sample population data
        print("\nSample population records:")
        for pop in db.query(Population).join(County).order_by(Population.year.desc()).limit(5).all():
            print(f"  {pop.year}: {pop.county.name} - {pop.population:,}")
        
    except Exception as e:
        print(f"Error checking data: {e}")
        return 1
    finally:
        db.close()
    
    return 0

if __name__ == "__main__":
    import sys
    sys.exit(check_data())
