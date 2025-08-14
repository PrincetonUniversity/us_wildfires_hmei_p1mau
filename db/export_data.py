import sys
import csv
from sqlalchemy.orm import Session
from sqlalchemy import asc
from db.models import (
    County, DailyPM25, Population,
    YearlyPM25Summary, MonthlyPM25Summary, SeasonalPM25Summary,
    BaselineMortalityRate, CDCBaselineMortalityRate,
    ExcessMortalitySummary, ExceedanceSummary,
    DecompositionSummary, FireAttributionBin, AQSData
)
from db.database import SessionLocal

# Map of table/model names to ORM classes
MODEL_MAP = {
    "counties": County,
    "daily_pm25": DailyPM25,
    "population": Population,
    "yearly_pm25_summary": YearlyPM25Summary,
    "monthly_pm25_summary": MonthlyPM25Summary,
    "seasonal_pm25_summary": SeasonalPM25Summary,
    "baseline_mortality_rate": BaselineMortalityRate,
    "cdc_baseline_mortality_rate": CDCBaselineMortalityRate,
    "excess_mortality_summary": ExcessMortalitySummary,
    "exceedance_summary": ExceedanceSummary,
    "decomposition_summary": DecompositionSummary,
    "fire_attribution_bin": FireAttributionBin,
    "aqs_data": AQSData
}

SORT_COLUMNS = ["fips", "year", "age_group"]

def export_model_to_csv(model_class, output_csv):
    session: Session = SessionLocal()
    try:
        columns = model_class.__table__.columns.keys()

        # Determine which of fips, year, age_group exist in the model
        sort_fields = [getattr(model_class, col) for col in SORT_COLUMNS if col in columns]

        query = session.query(model_class)
        if sort_fields:
            query = query.order_by(*[asc(f) for f in sort_fields])

        rows = query.all()
        if not rows:
            print(f"No data found for table '{model_class.__tablename__}'")
            return

        with open(output_csv, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(columns)
            for obj in rows:
                writer.writerow([getattr(obj, col) for col in columns])

        print(f"Exported {len(rows)} rows from '{model_class.__tablename__}' to '{output_csv}'")

    except Exception as e:
        print(f"Error exporting '{model_class.__tablename__}': {e}")

    finally:
        session.close()

def main():
    if len(sys.argv) != 2:
        print("Usage: python -m db.export_data <table_name>")
        print(f"Available tables: {', '.join(MODEL_MAP.keys())}")
        sys.exit(1)

    table_name = sys.argv[1].lower()
    model_class = MODEL_MAP.get(table_name)

    if not model_class:
        print(f"Table '{table_name}' not found. Available tables: {', '.join(MODEL_MAP.keys())}")
        sys.exit(1)

    output_csv = f"{table_name}.csv"
    export_model_to_csv(model_class, output_csv)

if __name__ == "__main__":
    main()
