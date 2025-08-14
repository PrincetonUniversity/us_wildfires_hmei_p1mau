# PM₂.₅ Wildfire Impact Map

An interactive web application for visualizing and analyzing the health impacts of wildfire smoke PM₂.₅ pollution across the contiguous United States. This project provides comprehensive data on PM₂.₅ levels, excess mortality, years of life lost (YLL), and demographic factors from 2006-2023.

## 🌟 Project Overview

This interface was developed by an undergraduate intern at Princeton University's High Meadows Environmental Institute (HMEI) with the Center for Policy Research on Energy and the Environment (CPREE). The project aims to support air quality management and public health research by providing accessible, interactive visualizations of wildfire smoke impacts.

## ✨ Key Features

### 🗺️ Interactive Map Visualization
- **County-level choropleth maps** showing PM₂.₅ concentrations and health impacts
- **Multiple data layers**: Average, maximum, and population-weighted PM₂.₅ data
- **Time controls**: Yearly, monthly, and seasonal data views (2006-2023)
- **Dynamic legends** with color-coded scales and units (µg/m³)

### 📊 Health Impact Analysis
- **Excess mortality estimates** by county and age group
- **Years of Life Lost (YLL)** calculations
- **Baseline mortality rates** from CDC Wonder data

### 🔍 Data Exploration Tools
- **County information panels** with detailed statistics
- **Bar charts** for temporal trends and decomposition analysis
- **Interactive hover effects** with real-time data display
- **Multi-metric comparisons** (fire vs. non-fire PM₂.₅)

### 📈 Advanced Analytics
- **Concentration-Response Functions** from peer-reviewed research
- **Statistical models** including GEMM and Binned Poisson approaches
- **Decomposition analysis** for understanding contributing factors
- **EPA exceedance tracking** (2021-2023 averages vs. standards)

### 📥 Data Downloads
- **PM₂.₅ data** in CSV format with time period selection
- **Excess mortality data** with demographic breakdowns
- **YLL calculations** by county and age group
- **Filtered exports** by selected time periods and metrics

## 🌐 Live Access

The PM₂.₅ Wildfire Impact Map is available online at:

**[https://usfirepollution.mauzerall.scholar.princeton.edu/](https://usfirepollution.mauzerall.scholar.princeton.edu/)**

Access the interactive map, explore health impact data, and download datasets directly through your web browser.

## 🏗️ Architecture

### Frontend
- **React 18** with Material-UI components
- **Maplibre GL JS** for interactive mapping
- **Responsive design** for desktop and mobile devices
- **Component-based architecture** for maintainability

### Backend
- **FastAPI** (Python) for high-performance API
- **PostgreSQL** with PostGIS for geospatial data
- **SQLAlchemy** ORM for database operations
- **GeoPandas** for spatial data processing

### Data Sources
- **PM₂.₅ Data**: Surface monitors, satellite observations, model simulations
- **Population Data**: US Census API (ACS 5-year and 1-year estimates)
- **Health Data**: CDC Wonder, peer-reviewed epidemiological studies
- **Geographic Data**: US Census Bureau shapefiles (2018)

## 📊 Data & Methodology

### PM₂.₅ Estimation
- **Combined approach** integrating multiple data sources
- **Fire attribution** using concentration-response functions
- **Quality control** and validation procedures

### Health Impact Calculations
- **Excess mortality** using Burnett et al.,  Ma et al., Qiu et al. CRFs
- **Years of Life Lost** with age-specific life expectancy data
- **Demographic analysis** for health equity assessment

### Research Foundation
This interface is part of ongoing research on improving wildfire smoke PM₂.₅ estimates to support US air quality management. The methodology incorporates peer-reviewed research from leading institutions and follows EPA guidelines for air quality assessment.


## 📚 Documentation

- **[API Documentation](docs/BACKEND_API_DOCUMENTATION.md)** - Complete API reference
- **[Database Schema](docs/DATABASE_SCHEMA_DOCUMENTATION.md)** - Database structure and relationships
- **[Frontend Components](docs/FRONTEND_COMPONENT_DOCUMENTATION.md)** - React component documentation
- **[Deployment Guide](DOCKER_README.md)** - Docker and production deployment

## 📄 License

This project is part of academic research at Princeton University. Please contact the development team for licensing and usage permissions.

## 🙏 Acknowledgments

- **High Meadows Environmental Institute (HMEI)** - Project support and resources
- **Center for Policy Research on Energy and the Environment (CPREE)** - Research collaboration

---

*This project represents ongoing research in environmental health and air quality management. For the latest updates and research findings, please refer to academic publications.*
