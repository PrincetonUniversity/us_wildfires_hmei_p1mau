#!/bin/bash

# Test script to verify data extraction
echo "Testing data.zip extraction locally..."

# Create a temporary directory
TEST_DIR="/tmp/test_extraction"
mkdir -p $TEST_DIR
cd $TEST_DIR

# Copy data.zip
cp /Users/mhood/Documents/source/us_wildfires_hmei_p1mau/data.zip .

# Extract and check contents
echo "Extracting data.zip..."
unzip -q data.zip

echo "Extraction complete. Directory structure:"
find . -type d | head -20

echo "Data files found:"
find . -name "*.csv" -o -name "*.json" -o -name "*.parquet" | head -10

# Clean up
cd /
rm -rf $TEST_DIR

echo "Test complete."
