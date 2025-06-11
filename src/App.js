import React, { useState, useEffect } from 'react';
import { Box, Container, CssBaseline, Typography } from '@mui/material';
import Map from './components/Map';

function App() {
  const [error, setError] = useState(null);
  const mapboxToken = process.env.REACT_APP_MAPBOX_TOKEN;

  // Check if Mapbox token is available
  useEffect(() => {
    if (!mapboxToken || mapboxToken === 'YOUR_MAPBOX_ACCESS_TOKEN') {
      setError('Mapbox token is missing or invalid. Please set REACT_APP_MAPBOX_TOKEN in your .env file.');
    }
  }, [mapboxToken]);

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
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100vw',
      margin: 0,
      padding: 0,
      overflow: 'hidden'
    }}>
      <CssBaseline />

      {/* Header */}
      <Box component="header" sx={{ bgcolor: '#1976d2', color: 'white', py: 2, px: 4 }}>
        <Container maxWidth="xl">
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
            PM2.5 Wildfire Impact Map
          </Typography>
        </Container>
      </Box>

      {/* Map Container */}
      <Box sx={{ flex: 1, position: 'relative' }}>
        <Map mapboxToken={mapboxToken} stateAbbr="CA" />
      </Box>
    </Box>
  );
}

export default App;
