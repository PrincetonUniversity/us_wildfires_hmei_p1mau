import logging
from sqlalchemy import func, and_
from sqlalchemy.orm import Session
from .database import SessionLocal
from .models import County, DailyPM25, Population, YearlyPM25Summary, MonthlyPM25Summary, SeasonalPM25Summary, BaselineMortalityRate, AnnualHealthMetric

def check_data():
    """Check the loaded data in the database."""
    db = SessionLocal()
    try:
        # Counties
        county_count = db.query(County).count()
        print(f"\n=== Counties ===")
        print(f"Total counties: {county_count}")
        print("Sample counties:")
        for county in db.query(County).limit(3).all():
            print(f"  {county.fips}: {county.name} (index: {county.index})")

        # Daily PM2.5
        pm25_count = db.query(DailyPM25).count()
        print(f"\n=== Daily PM2.5 Data ===")
        print(f"Total PM2.5 records: {pm25_count:,}")
        print("Sample PM2.5 records:")
        for pm25 in db.query(DailyPM25).limit(3).all():
            print(f"  {pm25.date}: {pm25.fips} - Total: {pm25.total:.2f}, Fire: {pm25.fire:.2f}, Non-fire: {pm25.nonfire:.2f}")

        # Population
        pop_count = db.query(Population).count()
        print(f"\n=== Population Data ===")
        print(f"Total population records: {pop_count:,}")
        print("Sample population records:")
        for pop in db.query(Population).limit(3).all():
            print(f"  {pop.year}: {pop.fips} - {pop.population:,}")

        # Yearly Summary
        yearly_count = db.query(YearlyPM25Summary).count()
        print(f"\n=== Yearly PM2.5 Summary ===")
        print(f"Total yearly summary records: {yearly_count:,}")
        print("Sample yearly summary records:")
        for y in db.query(YearlyPM25Summary).limit(3).all():
            print(f"  {y.year} {y.fips}: avg_total={y.avg_total:.2f}, max_nonfire={getattr(y, 'max_nonfire', None)}, pop_weighted_total={getattr(y, 'pop_weighted_total', None)}")

        # Monthly Summary
        monthly_count = db.query(MonthlyPM25Summary).count()
        print(f"\n=== Monthly PM2.5 Summary ===")
        print(f"Total monthly summary records: {monthly_count:,}")
        print("Sample monthly summary records:")
        for m in db.query(MonthlyPM25Summary).limit(3).all():
            print(f"  {m.year}-{m.month} {m.fips}: avg_total={m.avg_total:.2f}, max_nonfire={getattr(m, 'max_nonfire', None)}, pop_weighted_total={getattr(m, 'pop_weighted_total', None)}")

        # Seasonal Summary
        seasonal_count = db.query(SeasonalPM25Summary).count()
        print(f"\n=== Seasonal PM2.5 Summary ===")
        print(f"Total seasonal summary records: {seasonal_count:,}")
        print("Sample seasonal summary records:")
        for s in db.query(SeasonalPM25Summary).limit(3).all():
            print(f"  {s.year} {s.season} {s.fips}: avg_total={s.avg_total:.2f}, max_nonfire={getattr(s, 'max_nonfire', None)}, pop_weighted_total={getattr(s, 'pop_weighted_total', None)}")

        # Baseline Mortality Rate
        bmr_count = db.query(BaselineMortalityRate).count()
        print(f"\n=== Baseline Mortality Rate ===")
        print(f"Total baseline mortality records: {bmr_count:,}")
        print("Sample baseline mortality records:")
        for b in db.query(BaselineMortalityRate).limit(3).all():
            print(f"  {b.year} {b.fips} age_group={b.age_group} stat_type={b.stat_type} value={b.value} allage_flag={b.allage_flag} source={b.source}")
        year = 2020
        print("YearlyPM25Summary:", db.query(YearlyPM25Summary).filter(YearlyPM25Summary.year == year).count())
        print("Population:", db.query(Population).filter(Population.year == year).count())
        print("BaselineMortalityRate:", db.query(BaselineMortalityRate).filter(
            BaselineMortalityRate.year == year,
            BaselineMortalityRate.stat_type == '1',
            BaselineMortalityRate.allage_flag == True
        ).count())

        # Annual Health Metric
        ahm_count = db.query(AnnualHealthMetric).count()
        print(f"\n=== Annual Health Metric ===")
        print(f"Total annual health metric records: {ahm_count:,}")
        print("Sample annual health metric records:")
        for a in db.query(AnnualHealthMetric).limit(3).all():
            print(f"  {a.year} {a.fips} metric={a.metric_name} value={a.value}")

    except Exception as e:
        print(f"Error checking data: {e}")
        return 1
    finally:
        db.close()
    return 0

if __name__ == "__main__":
    import sys
    sys.exit(check_data())
