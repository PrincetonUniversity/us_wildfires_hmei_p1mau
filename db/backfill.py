from db.load_data import DataLoader
from db.models import Population

def main():
    print("Backfilling new data...")
    with DataLoader() as loader:
        # Clear the Population table before backfilling
        print("Clearing Population table...")
        loader.db.query(Population).delete()
        loader.db.commit()
        print("Population table cleared.")
        loader.load_population_data_api()
    print("Done! All tables updated.")

if __name__ == "__main__":
    main()