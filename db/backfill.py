from db.load_data import DataLoader
from db.models import ExcessMortalitySummary

def main():
    print("Backfilling new data...")
    with DataLoader() as loader:
        # Clear the table before backfilling
        print("Clearing table...")
        loader.db.query(ExcessMortalitySummary).delete()
        loader.db.commit()
        print("Table cleared.")
        loader.excess_mortality_summary()
    print("Done! All tables updated.")

if __name__ == "__main__":
    main()