import React, { useState, useEffect } from 'react';
import { Box, Container, CssBaseline, Typography } from '@mui/material';
import Map from './components/Map';
import Sidebar from './components/Sidebar';
import CountyBarChart from './components/CountyBarChart';

const PM25_LAYERS = ['average', 'max', 'pop_weighted'];
const HEALTH_LAYERS = ['mortality', 'population'];

function App() {
  const [error, setError] = useState(null);
  // Single active layer and sublayer
  const [activeLayer, setActiveLayer] = useState('average'); // e.g., 'average', 'max', 'pop_weighted', 'mortality', 'population'
  const [pm25SubLayer, setPm25SubLayer] = useState('total'); // 'total', 'fire', 'nonfire'
  const [timeControls, setTimeControls] = useState({ timeScale: 'yearly', year: 2023, month: 1, season: 'winter' });
  const [selectedCounty, setSelectedCounty] = useState(null); // Clicked county
  const [hoveredCounty, setHoveredCounty] = useState(null); // Hovered county
  const [lastHoveredCounty, setLastHoveredCounty] = useState(null); // Store last full hover data
  const [loading, setLoading] = useState(false);
  const [mapRefreshKey, setMapRefreshKey] = useState(0); // triggers map data refresh
  const mapboxToken = process.env.REACT_APP_MAPBOX_TOKEN;

  useEffect(() => {
    if (!mapboxToken || mapboxToken === 'YOUR_MAPBOX_ACCESS_TOKEN') {
      setError('Mapbox token is missing or invalid. Please set REACT_APP_MAPBOX_TOKEN in your .env file.');
    }
  }, [mapboxToken]);

  // Handler for layer selection
  const handleSetActiveLayer = (layer) => {
    if (PM25_LAYERS.includes(layer)) {
      setActiveLayer(layer);
      setPm25SubLayer('total');
    } else if (HEALTH_LAYERS.includes(layer)) {
      setActiveLayer(layer);
      setPm25SubLayer('');
    } else {
      setActiveLayer(layer);
    }
  };
  // Handler for PM2.5 sublayer
  const handleSetPm25SubLayer = (subLayer) => {
    setPm25SubLayer(subLayer);
    // If not on a PM2.5 layer, switch to default PM2.5
    if (!PM25_LAYERS.includes(activeLayer)) {
      setActiveLayer('average');
    }
  };
  const handleTimeControlsChange = (controls) => {
    setTimeControls(controls);
    setSelectedCounty(null); // Clear county info on time scale change
  };
  const handleMapLoaded = () => {
    setLoading(false);
  };
  // Handler for hover
  const handleCountyHover = (county) => {
    setHoveredCounty(county);
    if (county) setLastHoveredCounty(county);
  };
  // Handler for click: use lastHoveredCounty
  const handleCountySelect = (county) => {
    if (selectedCounty && county && selectedCounty.fips === selectedCounty.fips) {
      setSelectedCounty(null); // Deselect if clicking same county
    } else if (lastHoveredCounty && county && lastHoveredCounty.fips === county.fips) {
      setSelectedCounty(lastHoveredCounty);
    } else if (county) {
      setSelectedCounty(county); // fallback, should always have lastHoveredCounty
    }
  };

  // Fetch bar chart data for selected county
  const fetchBarChartData = async (county, timeControls) => {
    if (!county || !county.fips) return null;
    let params = new URLSearchParams();
    let endpoint = `/api/pm25/bar_chart/${county.fips}`;
    const { timeScale, year, month, season } = timeControls;
    if (timeScale === 'yearly') {
      params.append('time_scale', 'yearly');
      params.append('start_year', '2013');
      params.append('end_year', '2023');
    } else if (timeScale === 'monthly') {
      params.append('time_scale', 'daily');
      params.append('year', year.toString());
      params.append('month', month.toString());
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 1);
      params.append('start_date', startDate.toISOString().split('T')[0]);
      params.append('end_date', endDate.toISOString().split('T')[0]);
    } else if (timeScale === 'seasonal') {
      params.append('time_scale', 'daily');
      params.append('year', year.toString());
      params.append('season', season);
      let startDate, endDate;
      if (season === 'winter') {
        startDate = new Date(year - 1, 11, 21);
        endDate = new Date(year, 2, 21);
      } else if (season === 'spring') {
        startDate = new Date(year, 2, 21);
        endDate = new Date(year, 5, 21);
      } else if (season === 'summer') {
        startDate = new Date(year, 5, 21);
        endDate = new Date(year, 8, 21);
      } else if (season === 'fall') {
        startDate = new Date(year, 8, 21);
        endDate = new Date(year, 11, 21);
      }
      params.append('start_date', startDate.toISOString().split('T')[0]);
      params.append('end_date', endDate.toISOString().split('T')[0]);
    }
    const response = await fetch(`http://localhost:8000${endpoint}?${params}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data;
  };

  // Handler to clear selection (for X button)
  const handleClearSelectedCounty = () => {
    setSelectedCounty(null);
  };

  if (error) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, textAlign: 'center' }}>
        <Typography color="error" variant="h5" gutterBottom>
          Error
        </Typography>
        <Typography color="textSecondary" paragraph>
          {error}
        </Typography>
      </Container>
    );
  }

  return (
    <>
      <CssBaseline />
      {/* Header */}
      <Box component="header" sx={{ bgcolor: '#1976d2', color: 'white', py: 1, px: 1 }}>
        <Container maxWidth="xl">
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
            PM2.5 Wildfire Impact Map
          </Typography>
        </Container>
      </Box>
      {/* Main content row */}
      <Box sx={{ display: 'flex', flexDirection: 'row', height: 'calc(100vh - 64px)', width: '100vw', margin: 0, padding: 0, overflow: 'hidden' }}>
        {/* Map Area */}
        <Box sx={{ flex: 1, position: 'relative' }}>
          <Map
            mapboxToken={mapboxToken}
            stateAbbr="CA"
            activeLayer={activeLayer}
            pm25SubLayer={pm25SubLayer}
            timeControls={timeControls}
            onCountySelect={handleCountySelect}
            onCountyHover={handleCountyHover}
            mapRefreshKey={mapRefreshKey}
            onMapLoaded={handleMapLoaded}
            selectedCounty={selectedCounty}
          />
        </Box>
        {/* Sidebar */}
        <Sidebar
          activeLayer={activeLayer}
          setActiveLayer={handleSetActiveLayer}
          pm25SubLayer={pm25SubLayer}
          setPm25SubLayer={handleSetPm25SubLayer}
          timeControls={timeControls}
          setTimeControls={handleTimeControlsChange}
          selectedCounty={selectedCounty ? selectedCounty : hoveredCounty}
          loading={loading}
          onClearSelectedCounty={handleClearSelectedCounty}
        />
      </Box>
    </>
  );
}

export default App;
