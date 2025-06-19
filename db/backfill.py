from db.load_data import DataLoader

def main():
    print("Backfilling new summary columns (pop_weighted, max_nonfire, etc)...")
    with DataLoader() as loader:
        loader.preprocess_aggregations()
        loader.load_baseline_mortality()
    print("Done! All summary tables updated.")

if __name__ == "__main__":
    main()