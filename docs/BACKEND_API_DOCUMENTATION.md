# Backend API Documentation

## Overview

The PM₂.₅ Wildfire Impact Map backend provides a comprehensive REST API built with FastAPI. The API serves geospatial data, time series analysis, mortality impact calculations, and statistical summaries for US counties.

## Base URL

```
https://usfirepollution.mauzerall.scholar.princeton.edu
```

## Authentication

Currently, the API does not require authentication. All endpoints are publicly accessible.

## Response Format

All API responses are in JSON format. Geospatial data is returned as GeoJSON FeatureCollections.

## Error Handling

The API uses standard HTTP status codes:

- `200 OK`: Successful request
- `400 Bad Request`: Invalid parameters
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

Error responses include a `detail` field with error information:

```json
{
  "detail": "Year required for yearly data"
}
```

---

## Choropleth Endpoints

### GET `/api/counties/choropleth/mortality`

Returns excess mortality data as GeoJSON for choropleth visualization.

**Parameters:**
- `year` (required, integer): Year for mortality data (e.g., 2020)
- `sub_metric` (optional, string): Mortality metric type
  - `"total"` (default): Total excess mortality
  - `"fire"`: Fire-related excess mortality
  - `"nonfire"`: Non-fire excess mortality
- `age_group` (optional, string): Comma-separated age group indices (e.g., "1,2,3")

**Example Request:**
```bash
curl "https://usfirepollution.mauzerall.scholar.princeton.edu/api/counties/choropleth/mortality?year=2020&sub_metric=fire&age_group=1,2,3"
```

**Response:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[...]]]
      },
      "properties": {
        "fips": "06001",
        "county_name": "Alameda County",
        "value": 0.15,
        "total_excess": 45.2,
        "fire_excess": 12.3,
        "nonfire_excess": 32.9,
        "population": 1671329
      }
    }
  ],
  "metadata": {
    "time_scale": "yearly",
    "year": 2020,
    "metric": "excess_mortality_fire",
    "feature_count": 3109,
    "age_group": "1,2,3"
  }
}
```

**Notes:**
- `value` represents the mortality rate per 100 population
- `total_excess`, `fire_excess`, `nonfire_excess` represent absolute excess mortality counts
- `population` is the total population for the county-year

### GET `/api/counties/choropleth/average`

Returns average PM₂.₅ data as GeoJSON.

**Parameters:**
- `time_scale` (required, string): Time scale for data aggregation
  - `"yearly"`: Annual averages
  - `"monthly"`: Monthly averages
  - `"seasonal"`: Seasonal averages
- `year` (required, integer): Year for data (2006-2023)
- `month` (optional, integer): Month (1-12) for monthly data
- `season` (optional, string): Season for seasonal data
  - `"winter"`, `"spring"`, `"summer"`, `"fall"`
- `sub_metric` (optional, string): PM₂.₅ metric type
  - `"total"` (default): Total PM₂.₅
  - `"fire"`: Fire-related PM₂.₅
  - `"nonfire"`: Non-fire PM₂.₅

**Example Request:**
```bash
curl "https://usfirepollution.mauzerall.scholar.princeton.edu/api/counties/choropleth/average?time_scale=yearly&year=2020&sub_metric=fire"
```

**Response:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[...]]]
      },
      "properties": {
        "fips": "06001",
        "county_name": "Alameda County",
        "value": 2.1,
        "avg_total": 8.5,
        "avg_fire": 2.1,
        "avg_nonfire": 6.4,
        "max_total": 45.2,
        "max_fire": 12.3,
        "days_count": 366
      }
    }
  ],
  "metadata": {
    "time_scale": "yearly",
    "year": 2020,
    "metric": "average_pm25_fire",
    "feature_count": 3109
  }
}
```

### GET `/api/counties/choropleth/max`

Returns maximum PM₂.₅ data as GeoJSON.

**Parameters:** Same as average endpoint

**Response:** Similar to average endpoint, but `value` represents maximum PM₂.₅ levels

### GET `/api/counties/choropleth/pop_weighted`

Returns population-weighted PM₂.₅ data as GeoJSON.

**Parameters:** Same as average endpoint

**Response:** Similar to average endpoint, but `value` represents population-weighted PM₂.₅ levels

### GET `/api/counties/choropleth/population`

Returns population data as GeoJSON.

**Parameters:**
- `year` (optional, integer): Year for population data (default: 2020)

**Response:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[...]]]
      },
      "properties": {
        "fips": "06001",
        "county_name": "Alameda County",
        "value": 1671329,
        "total_population": 1671329,
        "age_groups": {
          "0-4": 95000,
          "5-9": 92000,
          "10-14": 89000
        }
      }
    }
  ],
  "metadata": {
    "year": 2020,
    "metric": "population",
    "feature_count": 3109
  }
}
```

### GET `/api/counties/choropleth/yll`

Returns Years of Life Lost (YLL) data as GeoJSON.

**Parameters:**
- `year` (required, integer): Year for YLL data
- `sub_metric` (optional, string): YLL metric type
  - `"total"` (default): Total YLL
  - `"fire"`: Fire-related YLL
  - `"nonfire"`: Non-fire YLL
- `age_group` (optional, string): Comma-separated age group indices

**Response:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[...]]]
      },
      "properties": {
        "fips": "06001",
        "county_name": "Alameda County",
        "value": 0.123,
        "yll_total": 1234.5,
        "yll_fire": 456.7,
        "yll_nonfire": 777.8,
        "population": 1671329
      }
    }
  ],
  "metadata": {
    "year": 2020,
    "metric": "yll_total",
    "feature_count": 3109
  }
}
```

### GET `/api/counties/choropleth/exceedance_8`

Returns exceedance data for 8 µg/m³ threshold as GeoJSON.

**Parameters:**
- `year` (required, integer): Year for exceedance data

**Response:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[...]]]
      },
      "properties": {
        "fips": "06001",
        "county_name": "Alameda County",
        "value": 45,
        "exceedance_days": 45,
        "fire_exceedance_days": 12,
        "nonfire_exceedance_days": 33,
        "avg_pm25": 8.5
      }
    }
  ],
  "metadata": {
    "year": 2020,
    "threshold": 8,
    "metric": "exceedance_8",
    "feature_count": 3109
  }
}
```

### GET `/api/counties/choropleth/exceedance_9`

Returns exceedance data for 9 µg/m³ threshold as GeoJSON.

**Parameters:** Same as exceedance_8 endpoint

**Response:** Similar to exceedance_8 endpoint, but for 9 µg/m³ threshold

---

## Time Series Endpoints

### GET `/api/pm25/bar_chart/{fips}`

Returns time series data for a specific county.

**Parameters:**
- `fips` (path, string): County FIPS code
- `time_scale` (optional, string): Time scale for data
  - `"yearly"` (default): Annual data
  - `"monthly"`: Monthly data
  - `"seasonal"`: Seasonal data
  - `"daily"`: Daily data
- `start_year` (optional, integer): Start year for range
- `end_year` (optional, integer): End year for range
- `year` (optional, integer): Specific year
- `month` (optional, integer): Month for monthly/daily data
- `season` (optional, string): Season for seasonal/daily data
- `sub_metric` (optional, string): PM₂.₅ metric type

**Example Request:**
```bash
curl "https://usfirepollution.mauzerall.scholar.princeton.edu/api/pm25/bar_chart/06001?time_scale=yearly&start_year=2018&end_year=2020"
```

**Response:**
```json
[
  {
    "year": 2018,
    "total": 7.8,
    "fire": 1.9,
    "nonfire": 5.9,
    "max_total": 42.1,
    "max_fire": 11.2,
    "days_count": 365
  },
  {
    "year": 2019,
    "total": 8.2,
    "fire": 2.3,
    "nonfire": 5.9,
    "max_total": 48.7,
    "max_fire": 15.6,
    "days_count": 365
  },
  {
    "year": 2020,
    "total": 8.5,
    "fire": 2.1,
    "nonfire": 6.4,
    "max_total": 45.2,
    "max_fire": 12.3,
    "days_count": 366
  }
]
```

---

## Mortality Endpoints

### GET `/api/excess_mortality`

Returns excess mortality summary data.

**Parameters:**
- `year` (optional, integer): Year to filter
- `fips` (optional, string): County FIPS code to filter
- `sub_metric` (optional, string): Mortality metric type
  - `"total"` (default): Total excess mortality
  - `"fire"`: Fire-related excess mortality
  - `"nonfire"`: Non-fire excess mortality
- `age_group` (optional, string): Comma-separated age group indices

**Example Request:**
```bash
curl "https://usfirepollution.mauzerall.scholar.princeton.edu/api/excess_mortality?year=2020&fips=06001&sub_metric=fire"
```

**Response:**
```json
[
  {
    "fips": "06001",
    "county_name": "Alameda County",
    "year": 2020,
    "excess_mortality": 12.3,
    "total_excess": 45.2,
    "fire_excess": 12.3,
    "nonfire_excess": 32.9,
    "yll_total": 1234.5,
    "yll_fire": 456.7,
    "yll_nonfire": 777.8,
    "population": 1671329,
    "method": "gemm"
  }
]
```

---

## Decomposition Endpoints

### GET `/api/counties/decomp/{fips}`

Returns decomposition analysis for factors contributing to mortality changes.

**Parameters:**
- `fips` (path, string): County FIPS code
- `pm25_type` (optional, string): PM₂.₅ type for analysis
  - `"total"` (default): Total PM₂.₅
  - `"fire"`: Fire-related PM₂.₅

**Example Request:**
```bash
curl "https://usfirepollution.mauzerall.scholar.princeton.edu/api/counties/decomp/06001?pm25_type=fire"
```

**Response:**
```json
{
  "fips": "06001",
  "county_name": "Alameda County",
  "pm25_type": "fire",
  "start_year": 2006,
  "end_year": 2023,
  "decomposition": {
    "population_growth": 0.15,
    "population_ageing": 0.08,
    "baseline_mortality_change": -0.12,
    "exposure_change": 0.05,
    "total_change": 0.16
  },
  "methodology": "Based on Yang et al. (2022) decomposition framework"
}
```

---

## Statistics Endpoints

### GET `/api/counties/statistics`

Returns statistical summaries across all counties.

**Parameters:**
- `time_scale` (required, string): Time scale for statistics
  - `"yearly"`: Annual statistics
  - `"monthly"`: Monthly statistics
  - `"seasonal"`: Seasonal statistics
- `year` (required, integer): Year for statistics
- `month` (optional, integer): Month for monthly statistics
- `season` (optional, string): Season for seasonal statistics

**Example Request:**
```bash
curl "https://usfirepollution.mauzerall.scholar.princeton.edu/api/counties/statistics?time_scale=yearly&year=2020"
```

**Response:**
```json
{
  "time_scale": "yearly",
  "year": 2020,
  "statistics": {
    "mean_total_pm25": 8.5,
    "mean_fire_pm25": 2.1,
    "mean_nonfire_pm25": 6.4,
    "median_total_pm25": 7.2,
    "median_fire_pm25": 1.8,
    "min_total_pm25": 2.1,
    "max_total_pm25": 45.2,
    "std_total_pm25": 3.8,
    "county_count": 3109,
    "exceedance_8_count": 1250,
    "exceedance_9_count": 890
  }
}
```

---

## Utility Endpoints

### GET `/api/health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0"
}
```

### GET `/api/counties/list`

Returns a list of all counties with basic information.

**Parameters:** None

**Response:**
```json
[
  {
    "fips": "06001",
    "name": "Alameda County",
    "state": "CA"
  }
]
```

---

## Data Download Endpoints

### GET `/api/download/pm25`

Downloads PM₂.₅ data as CSV for research and analysis.

**Parameters:**
- `time_scale` (required, string): Time scale for data aggregation
  - `"yearly"`: Annual summaries
  - `"monthly"`: Monthly summaries  
  - `"seasonal"`: Seasonal summaries
- `start_year` (required, integer): Start year (2006-2023)
- `end_year` (required, integer): End year (2006-2023)

**Example Request:**
```bash
curl "https://usfirepollution.mauzerall.scholar.princeton.edu/api/download/pm25?time_scale=yearly&start_year=2020&end_year=2023"
```

**Response:**
- **Content-Type:** `text/csv`
- **Headers:** `Content-Disposition: attachment; filename=pm25_data_yearly_2020_2023.csv`
- **Body:** CSV file with columns:
  - County_FIPS, County_Name, Year, Avg_Total_PM25, Avg_Fire_PM25, Avg_Nonfire_PM25
  - Max_Total_PM25, Max_Fire_PM25, Max_Nonfire_PM25, Pop_Weighted_Avg_PM25, Days_Count

**Notes:**
- For monthly data, includes Month column
- For seasonal data, includes Season column
- County names are quoted to handle commas
- PM₂.₅ values are formatted to 2 decimal places
- Returns 404 if no data found for specified parameters

### GET `/api/download/mortality`

Downloads excess mortality data as CSV for health impact analysis.

**Parameters:**
- `start_year` (required, integer): Start year (2006-2023)
- `end_year` (required, integer): End year (2006-2023)
- `age_groups` (optional, string): Comma-separated age group indices (e.g., "1,2,3")

**Example Request:**
```bash
curl "https://usfirepollution.mauzerall.scholar.princeton.edu/api/download/mortality?start_year=2020&end_year=2023&age_groups=1,2,3"
```

**Response:**
- **Content-Type:** `text/csv`
- **Headers:** `Content-Disposition: attachment; filename=mortality_data_2020_2023.csv`
- **Body:** CSV file with columns:
  - County_FIPS, County_Name, Year, Age_Group, Population
  - Total_Excess_Mortality, Fire_Excess_Mortality, Nonfire_Excess_Mortality, Calculation_Method

**Age Group Mapping:**
- 1: 0-4, 2: 5-9, 3: 10-14, 4: 15-19, 5: 20-24, 6: 25-29, 7: 30-34, 8: 35-39
- 9: 40-44, 10: 45-49, 11: 50-54, 12: 55-59, 13: 60-64, 14: 65-69, 15: 70-74
- 16: 75-79, 17: 80-84, 18: 85+

**Notes:**
- Age groups are displayed as readable ranges (e.g., "0-4" instead of "1")
- Mortality rates are formatted to 3 decimal places
- Default calculation method is "GEMM" if not specified

### GET `/api/download/yll`

Downloads Years of Life Lost (YLL) data as CSV for comprehensive health impact assessment.

**Parameters:**
- `start_year` (required, integer): Start year (2006-2023)
- `end_year` (required, integer): End year (2006-2023)
- `age_groups` (optional, string): Comma-separated age group indices (e.g., "1,2,3")

**Example Request:**
```bash
curl "https://usfirepollution.mauzerall.scholar.princeton.edu/api/download/yll?start_year=2020&end_year=2023&age_groups=1,2,3"
```

**Response:**
- **Content-Type:** `text/csv`
- **Headers:** `Content-Disposition: attachment; filename=yll_data_2020_2023.csv`
- **Body:** CSV file with columns:
  - County_FIPS, County_Name, Year, Age_Group, Population
  - Total_YLL, Fire_YLL, Nonfire_YLL, Life_Expectancy, Calculation_Method

**Life Expectancy Estimates (US averages):**
- 0-4: 80.0 years, 5-9: 75.0 years, 10-14: 70.0 years, 15-19: 65.0 years
- 20-24: 60.0 years, 25-29: 55.0 years, 30-34: 50.0 years, 35-39: 45.0 years
- 40-44: 40.0 years, 45-49: 35.0 years, 50-54: 30.0 years, 55-59: 25.0 years
- 60-64: 20.0 years, 65-69: 15.0 years, 70-74: 10.0 years, 75-79: 7.0 years
- 80-84: 5.0 years, 85+: 3.0 years

**Notes:**
- YLL = Excess Mortality × Life Expectancy at Death
- YLL values are formatted to 1 decimal place
- Life expectancy values are approximate US averages
- Combines excess mortality data with demographic life expectancy estimates

---

## Data Models and Schemas

### County Feature Properties

All choropleth endpoints return GeoJSON features with the following common properties:

```json
{
  "fips": "string",           // County FIPS code
  "county_name": "string",    // County name
  "value": "number",          // Primary value for visualization
  "geometry": "object"        // GeoJSON geometry
}
```

### PM₂.₅ Data Properties

PM₂.₅ endpoints include additional properties:

```json
{
  "avg_total": "number",      // Average total PM₂.₅
  "avg_fire": "number",       // Average fire-related PM₂.₅
  "avg_nonfire": "number",    // Average non-fire PM₂.₅
  "max_total": "number",      // Maximum total PM₂.₅
  "max_fire": "number",       // Maximum fire-related PM₂.₅
  "days_count": "integer"     // Number of days with data
}
```

### Mortality Data Properties

Mortality endpoints include additional properties:

```json
{
  "excess_mortality": "number",    // Excess mortality rate
  "total_excess": "number",        // Total excess mortality count
  "fire_excess": "number",         // Fire-related excess mortality
  "nonfire_excess": "number",      // Non-fire excess mortality
  "yll_total": "number",           // Total years of life lost
  "yll_fire": "number",            // Fire-related YLL
  "yll_nonfire": "number",         // Non-fire YLL
  "population": "integer"          // County population
}
```

---

## Query Parameters and Filtering

### Time Scale Options

- **Yearly**: Annual aggregations (2006-2023)
- **Monthly**: Monthly aggregations within a year
- **Seasonal**: Seasonal aggregations (winter, spring, summer, fall)
- **Daily**: Daily data for specific periods

### Sub-metric Options

- **Total**: Combined fire and non-fire data
- **Fire**: Fire-related data only
- **Non-fire**: Non-fire data only

### Age Group Indices

Age groups are specified as comma-separated indices:

- `1`: 0-4 years
- `2`: 5-9 years
- `3`: 10-14 years
- `4`: 15-19 years
- `5`: 20-24 years
- `6`: 25-29 years
- `7`: 30-34 years
- `8`: 35-39 years
- `9`: 40-44 years
- `10`: 45-49 years
- `11`: 50-54 years
- `12`: 55-59 years
- `13`: 60-64 years
- `14`: 65-69 years
- `15`: 70-74 years
- `16`: 75-79 years
- `17`: 80-84 years
- `18`: 85+ years

---

## Performance and Optimization

### Database Indexes

The database includes optimized indexes for:
- County FIPS codes
- Date ranges
- Time scale aggregations
- Spatial queries (PostGIS)

### Caching Strategy

- County geometries cached in memory
- Summary table pre-computations
- API response caching for static data

### Query Optimization

- Use of summary tables for aggregations
- Efficient spatial joins with PostGIS
- Parameterized queries for prepared statements

---

## Error Codes and Troubleshooting

### Common Error Scenarios

**400 Bad Request:**
- Missing required parameters
- Invalid parameter values
- Unsupported time scales or metrics

**404 Not Found:**
- County FIPS code not found
- No data for specified time period
- Invalid endpoint path

**500 Internal Server Error:**
- Database connection issues
- Data processing errors
- Server configuration problems

### Debugging Tips

1. **Check Parameter Values**: Ensure all required parameters are provided
2. **Validate FIPS Codes**: Use valid 5-digit county FIPS codes
3. **Time Range**: Ensure year is within 2006-2023 range
4. **Data Availability**: Some counties may not have data for all time periods

---

## Rate Limiting and Usage

### Current Limits

- No rate limiting implemented
- All endpoints publicly accessible
- No API key required

### Recommended Usage

- Implement client-side caching for static data
- Use appropriate time ranges to minimize data transfer
- Consider batching requests for multiple counties

---

## Future Enhancements

### Planned Features

- **Authentication**: API key-based access control
- **Rate Limiting**: Request throttling for fair usage
- **Caching Headers**: ETags and cache control
- **Bulk Operations**: Multi-county data retrieval
- **Real-time Updates**: WebSocket support for live data

### API Versioning

- Current version: v1
- Backward compatibility maintained
- New versions will be available at `/api/v2/`

---

This comprehensive API documentation provides developers with all necessary information to integrate with the PM₂.₅ Wildfire Impact Map backend. For additional support or questions, refer to the main documentation or contact the development team. 