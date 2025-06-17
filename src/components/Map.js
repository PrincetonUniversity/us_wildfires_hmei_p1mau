import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { createRoot } from 'react-dom/client';
import CountyBarChart from './CountyBarChart';

// Color scale for PM2.5 values (yellow to orange to red)
const PM25_COLORS_TOTAL = [
  [0, '#fff7bc'],    // light yellow
  [2.5, '#fee391'],   // yellow
  [5, '#fec44f'],   // light orange
  [7.5, '#fe9929'],   // orange
  [10, '#ec7014'],  // dark orange
  [12.5, '#cc4c02']   // red (12.5+)
];

const PM25_COLORS_FIRE = [
  [0, '#fff7bc'],    // light yellow
  [0.5, '#fee391'],   // yellow
  [1.0, '#fec44f'],   // light orange
  [1.5, '#fe9929'],   // orange
  [2.0, '#ec7014'],  // dark orange
  [2.5, '#cc4c02']   // red (2.5+)
];

const POPULATION_COLORS = [
  [0, '#f7fbff'],      // very light blue
  [50000, '#deebf7'],  // light blue
  [100000, '#c6dbef'], // blue
  [250000, '#9ecae1'], // medium blue
  [500000, '#6baed6'], // darker blue
  [1000000, '#2171b5'] // dark blue
];

// State FIPS to abbreviation mapping
const STATE_FIPS_TO_ABBR = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE',
  '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA',
  '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN',
  '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM',
  '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
  '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA',
  '54': 'WV', '55': 'WI', '56': 'WY'
};

const getStateFromFIPS = (fips) => {
  if (!fips) return '';
  const stateFIPS = fips.toString().padStart(5, '0').substring(0, 2);
  return STATE_FIPS_TO_ABBR[stateFIPS] || '';
};

// Helper function to get season from month
const getSeasonFromMonth = (month) => {
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'fall';
  return 'winter';
};

// Helper function to calculate dynamic color scale based on data
const calculateDynamicColorScale = (data, metric) => {
  if (!data || !data.features || data.features.length === 0) {
    return //getColorScale(); // fallback to static scale
  }

  // Extract all values for the current metric
  const values = data.features
    .map(feature => feature.properties.value || 0)
    .filter(val => val > 0) // Remove zero values
    .sort((a, b) => a - b);

  if (values.length === 0) {
    return //getColorScale(); // fallback to static scale
  }

  const min = values[0];
  const max = values[values.length - 1];
  
  // Create 6 evenly distributed breakpoints
  const range = max - min;
  const step = range / 5;
  
  // Base colors (same as your existing scales)
  const colors = ['#fff7bc', '#fee391', '#fec44f', '#fe9929', '#ec7014', '#cc4c02'];
  
  return colors.map((color, i) => [min + (step * i), color]);
};

const Map = ({ mapboxToken, stateAbbr }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeMetric, setActiveMetric] = useState('avg_total'); // 'avg_total', 'avg_fire', 'avg_nonfire', 'max_total', 'max_fire'
  const [timeScale, setTimeScale] = useState('yearly');
  const [year, setYear] = useState(2023);
  const [month, setMonth] = useState(1); // 1-12
  const [season, setSeason] = useState('winter');
  const [pendingUpdate, setPendingUpdate] = useState(false);
  const [choroplethData, setChoroplethData] = useState(null);
  const currentCountyRef = useRef(null);
  
  // Function to update the legend based on the current metric and data
  const updateLegend = () => {
    if (!map.current) return;
    
    const legend = document.getElementById('legend');
    if (!legend) return;
    
    const colorScale = getColorScale(choroplethData);
    const metricLabel = getMetricLabel(activeMetric);
    
    // Clear existing legend
    legend.innerHTML = '';
    
    // Add title
    const title = document.createElement('div');
    title.textContent = metricLabel;
    title.style.marginBottom = '5px';
    title.style.fontWeight = 'bold';
    legend.appendChild(title);
    
    // Add color gradient
    const gradient = document.createElement('div');
    gradient.style.display = 'flex';
    gradient.style.marginBottom = '5px';
    gradient.style.height = '10px';
    gradient.style.width = '100%';
    gradient.style.background = `linear-gradient(to right, ${colorScale.map(([_, color]) => color).join(', ')})`;
    legend.appendChild(gradient);
    
    // Add labels
    const labels = document.createElement('div');
    labels.style.display = 'flex';
    labels.style.justifyContent = 'space-between';
    labels.style.fontSize = '0.8em';
    
    // Add min and max values
    const minLabel = document.createElement('span');
    minLabel.textContent = colorScale[0][0].toFixed(1);
    
    const maxLabel = document.createElement('span');
    maxLabel.textContent = `${colorScale[colorScale.length - 1][0].toFixed(1)}+`;
    
    labels.appendChild(minLabel);
    labels.appendChild(maxLabel);
    legend.appendChild(labels);
  };

  // Function to fetch choropleth data with new API
  const fetchChoroplethData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        time_scale: timeScale,
        metric: activeMetric,
        ...(year && { year: year.toString() }),
        ...(timeScale === 'monthly' && month && { month: month.toString() }),
        ...(timeScale === 'seasonal' && season && { season }),
      });

      console.log('Fetching choropleth data with params:', params.toString());
      const response = await fetch(`http://localhost:8000/api/counties/choropleth?${params}`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch choropleth data: ${response.status} ${response.statusText}\n${errorText}`);
      }
      const data = await response.json();
      
      // Log the first feature to verify the data
      if (data.features && data.features.length > 0) {
        console.log('First feature properties:', data.features[0].properties);
      }
      
      setChoroplethData(data);
      return data;
    } catch (err) {
      console.error('Error fetching choropleth data:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Function to fetch bar chart data for a specific county
  const fetchBarChartData = async (fips) => {
    try {
      const params = new URLSearchParams({
        time_scale: 'yearly',
        start_year: '2013',
        end_year: '2023'
      });

      const response = await fetch(`http://localhost:8000/api/pm25/bar_chart/${fips}?${params}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to fetch bar chart data: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Ensure data is an array
      if (!Array.isArray(data)) {
        console.error('Expected array but got:', data);
        return [];
      }
      
      // Transform the data to match what the chart expects
      return data.map(item => ({
        year: item.year,
        timePeriod: item.year.toString(),
        label: item.year.toString(),
        fire: item.fire || 0,
        nonFire: item.nonfire || 0,
        total: item.total || 0
      }));
    } catch (err) {
      console.error('Error in fetchBarChartData:', err);
      // Return empty array instead of throwing to prevent breaking the UI
      return [];
    }
  };

  // Handle time scale changes
  const handleTimeScaleChange = (newScale) => {
    setTimeScale(newScale);
    setPendingUpdate(true);
  };

  // Handle year changes
  const handleYearChange = (newYear) => {
    setYear(newYear);
    setPendingUpdate(true);
  };

  // Handle month changes
  const handleMonthChange = (newMonth) => {
    setMonth(newMonth);
    setPendingUpdate(true);
  };

  // Handle season changes
  const handleSeasonChange = (newSeason) => {
    setSeason(newSeason);
    setPendingUpdate(true);
  };

  // Handle metric changes
  const handleMetricChange = async (newMetric) => {
    // Automatically fetch new data when metric changes
    if (map.current && map.current.isStyleLoaded()) {
      try {
        // DON'T set loading to true - keep it smooth
        const params = new URLSearchParams({
          time_scale: timeScale,
          metric: newMetric,
          ...(year && { year: year.toString() }),
          ...(timeScale === 'monthly' && month && { month: month.toString() }),
          ...(timeScale === 'seasonal' && season && { season }),
        });

        console.log('Fetching choropleth data with params:', params.toString());
        const response = await fetch(`http://localhost:8000/api/counties/choropleth?${params}`);
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch choropleth data: ${response.status} ${response.statusText}\n${errorText}`);
        }
        const data = await response.json();
        setChoroplethData(data);
        setActiveMetric(newMetric);
      } catch (err) {
        console.error('Error updating map data:', err);
        setError('Failed to update map data: ' + err.message);
      }
    }
  };

  // Handle submit button click
  const handleSubmit = async () => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    try {
      setLoading(true);
      // Fetch new data with current parameters
      const response = await fetchChoroplethData();
      // The fetchChoroplethData function will update choroplethData state
      setPendingUpdate(false);
    } catch (err) {
      console.error('Error updating map data:', err);
      setError('Failed to update map data: ' + err.message);
    }
  };

  // Initialize map when component mounts
  useEffect(() => {
    if (!mapboxToken) {
      setError('Mapbox token is missing');
      return;
    }

    if (!mapContainer.current) return;

    // Set Mapbox token
    mapboxgl.accessToken = mapboxToken;

    // Initialize map
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v10',
      bounds: [
        -150.0,  // West
        24.0,    // South
        -60.0,   // East
        50.0     // North
      ],
      padding: { top: 20, bottom: 20, left: 20, right: 20 }
    });

    // Disable map rotation using right click + drag
    map.current.dragRotate.disable();
    // Disable map rotation using touch rotation gesture
    map.current.touchZoomRotate.disableRotation();

    // Create a popup but don't add it to the map yet
    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: '400px'
    });

    // Load initial data when map is ready
    map.current.on('load', async () => {
      try {
        const data = await fetchChoroplethData();

        // Add source and layer
        if (map.current) {
          map.current.addSource('pm25', {
            type: 'geojson',
            data: data,
            generateId: true
          });

          // Add the fill layer for PM2.5
          map.current.addLayer({
            id: 'pm25-layer',
            type: 'fill',
            source: 'pm25',
            paint: {
              'fill-color': [
                'interpolate',
                ['linear'],
                ['get', 'value'], // The new API uses 'value' field
                ...getColorScale(choroplethData).reduce((acc, [value, color]) => acc.concat(value, color), [])
              ],
              'fill-opacity': 0.8,
              'fill-outline-color': 'rgba(0,0,0,0.2)'
            }
          });

          // Add hover effect
          map.current.on('mousemove', 'pm25-layer', async (e) => {
            if (e.features.length > 0) {
              const feature = e.features[0];
              const props = feature.properties;
              const countyId = props.GEOID || props.FIPS || props.fips;

              // Only update if we're hovering over a different county
              if (currentCountyRef.current !== countyId) {
                currentCountyRef.current = countyId;

                try {
                  // Fetch bar chart data for this county
                  const barChartData = await fetchBarChartData(countyId);

                  // Create a DOM node for React rendering
                  const popupNode = document.createElement('div');

                  // Add county name above chart
                  const nameDiv = document.createElement('div');
                  nameDiv.style.fontWeight = 'bold';
                  nameDiv.style.fontSize = '1.1em';
                  nameDiv.style.marginBottom = '8px';
                  const stateAbbr = getStateFromFIPS(countyId);
                  nameDiv.textContent = `${props.county_name || props.NAME || 'Unknown County'}, ${stateAbbr}`;
                  popupNode.appendChild(nameDiv);

                  // Add current PM2.5 value and other metrics
                  const valuesDiv = document.createElement('div');
                  valuesDiv.style.marginBottom = '8px';
                  valuesDiv.style.fontSize = '0.9em';
                  
                  // Format the current value based on the active metric
                  const currentValue = props.value || 0;
                  const formattedValue = currentValue.toFixed(2);

                // Create a more informative display
                valuesDiv.innerHTML = `
                  <div style="margin-bottom: 5px;">
                    <strong>Current Value:</strong> ${formattedValue} µg/m³
                  </div>
                  <div style="display: flex; margin-bottom: 3px;">
                    <span>Total PM2.5:</span> 
                    <span style="margin-left: 8px;">${(props.avg_total || 0).toFixed(2)} µg/m³</span>
                  </div>
                  <div style="display: flex; margin-bottom: 3px;">
                    <span>Fire PM2.5:</span> 
                    <span style="margin-left: 8px;">${(props.avg_fire || 0).toFixed(2)} µg/m³</span>
                  </div>
                  <div style="display: flex; margin-bottom: 3px;">
                    <span>Non-fire PM2.5:</span> 
                    <span style="margin-left: 8px;">${(props.avg_nonfire || 0).toFixed(2)} µg/m³</span>
                  </div>
                  ${props.population ? `
                  <div style="margin-top: 8px; padding-top: 5px; border-top: 1px solid #eee;">
                    <strong>Population:</strong> ${props.population.toLocaleString()}
                  </div>` : ''}
                `;
                  popupNode.appendChild(valuesDiv);

                  // Render chart if data is available
                  if (barChartData && barChartData.length > 0) {
                    const chartDiv = document.createElement('div');
                    chartDiv.style.width = '350px';
                    chartDiv.style.height = '180px';
                    popupNode.appendChild(chartDiv);
                    const root = createRoot(chartDiv);
                    root.render(<CountyBarChart data={barChartData} />);
                  }

                  map.current.getCanvas().style.cursor = 'pointer';
                  popup
                    .setLngLat(e.lngLat)
                    .setDOMContent(popupNode)
                    .addTo(map.current);
                } catch (err) {
                  console.error('Error fetching bar chart data:', err);
                  // Still show basic popup without chart
                  const popupNode = document.createElement('div');
                  const nameDiv = document.createElement('div');
                  nameDiv.style.fontWeight = 'bold';
                  nameDiv.style.fontSize = '1.1em';
                  const stateAbbr = getStateFromFIPS(countyId);
                  nameDiv.textContent = `${props.county_name || props.NAME || 'Unknown County'}, ${stateAbbr}`;
                  popupNode.appendChild(nameDiv);

                  const valueDiv = document.createElement('div');
                  valueDiv.textContent = `${getMetricLabel()}: ${(props.value || 0).toFixed(2)} µg/m³`;
                  popupNode.appendChild(valueDiv);

                  popup
                    .setLngLat(e.lngLat)
                    .setDOMContent(popupNode)
                    .addTo(map.current);
                }
              } else {
                // Just update the popup position for the same county
                popup.setLngLat(e.lngLat);
              }
            }
          });

          // Change the cursor back to a pointer when it leaves the layer
          map.current.on('mouseleave', 'pm25-layer', () => {
            map.current.getCanvas().style.cursor = '';
            popup.remove();
            currentCountyRef.current = null;
          });

          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading PM2.5 data:', err);        setError('Failed to load PM2.5 data');
        setLoading(false);
      }
    });

    // Cleanup
    return () => {
      if (map.current) {
        if (map.current.loaded()) {
          map.current.off('mousemove', 'pm25-layer');
          map.current.off('mouseleave', 'pm25-layer');
        }
        if (popup.isOpen()) {
          popup.remove();
        }
        map.current.remove();
        map.current = null;
      }
    };
  }, [mapboxToken, stateAbbr]);

  // Helper function to get color scale based on metric
  const getColorScale = (data = null) => {
    // If we have data, calculate dynamic scale
    if (data) {
      return calculateDynamicColorScale(data, activeMetric);
    }
    
    // Fallback to static scales
    if (activeMetric.includes('fire') && !activeMetric.includes('nonfire')) {
      return PM25_COLORS_FIRE;
    }
    return PM25_COLORS_TOTAL;
  };
  
  // Helper function to get metric label
  const getMetricLabel = (metric = activeMetric) => {
    const labels = {
      'avg_total': 'Average Total PM2.5',
      'avg_fire': 'Average Fire PM2.5',
      'avg_nonfire': 'Average Non-fire PM2.5',
      'max_total': 'Maximum Total PM2.5',
      'max_fire': 'Maximum Fire PM2.5'
    };
    return labels[metric] || 'PM2.5';
  };

  // Update map layers when choroplethData or activeMetric changes
  useEffect(() => {
    if (!map.current || !choroplethData) return;

    const mapInstance = map.current;
    
    // If layer doesn't exist, create it
    if (!mapInstance.getLayer('pm25-layer')) {
      // Add the source if it doesn't exist
      if (!mapInstance.getSource('pm25')) {
        mapInstance.addSource('pm25', {
          type: 'geojson',
          data: choroplethData,
          generateId: true
        });
      }

      // Add the layer
      mapInstance.addLayer({
        id: 'pm25-layer',
        type: 'fill',
        source: 'pm25',
        paint: {
          'fill-color': [
            'interpolate',
            ['linear'],
            ['get', 'value'],
            ...getColorScale(choroplethData).reduce((acc, [value, color]) => acc.concat(value, color), [])
          ],
          'fill-opacity': 0.8,
          'fill-outline-color': 'rgba(0,0,0,0.2)'
        }
      }, 'waterway-label');
    } else {
      // Layer exists, just update the data and paint properties
      mapInstance.getSource('pm25').setData(choroplethData);
      
      // Update the fill color based on new metric
      mapInstance.setPaintProperty('pm25-layer', 'fill-color', [
        'interpolate',
        ['linear'],
        ['get', 'value'],
        ...getColorScale(choroplethData).reduce((acc, [value, color]) => acc.concat(value, color), [])
      ]);
    }
    
    // Update the legend
    updateLegend();
    
  }, [choroplethData, activeMetric]);

  if (error) {
    return (
      <div style={{
        padding: '20px',
        backgroundColor: '#ffebee',
        color: '#c62828',
        borderRadius: '4px',
        margin: '10px'
      }}>
        <h3>Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#f0f0f0',
      overflow: 'hidden'
    }}>
      <div
        ref={mapContainer}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%'
        }}
      />
      
      {/* Legend */}
      <div id="legend" style={{
        position: 'absolute',
        bottom: '30px',
        right: '20px',
        backgroundColor: 'white',
        padding: '10px',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        zIndex: 1,
        width: '200px'
      }} />

      {/* Time Controls */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        backgroundColor: 'white',
        padding: '15px',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        zIndex: 1,
        minWidth: '250px'
      }}>
        <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>Time Controls</div>
        
        {/* Time Scale Selection */}
        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Time Scale:</label>
          <select 
            value={timeScale} 
            onChange={(e) => handleTimeScaleChange(e.target.value)}
            style={{ width: '100%', padding: '5px' }}
          >
            <option value="yearly">Yearly</option>
            <option value="monthly">Monthly</option>
            <option value="seasonal">Seasonal</option>
          </select>
        </div>

        {/* Year Selection */}
        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Year:</label>
          <select 
            value={year} 
            onChange={(e) => handleYearChange(parseInt(e.target.value))}
            style={{ width: '100%', padding: '5px' }}
          >
            {Array.from({length: 11}, (_, i) => 2013 + i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Month Selection (only for monthly time scale) */}
        {timeScale === 'monthly' && (
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Month:</label>
            <select 
              value={month} 
              onChange={(e) => handleMonthChange(parseInt(e.target.value))}
              style={{ width: '100%', padding: '5px' }}
            >
              {['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December']
                .map((name, i) => (
                  <option key={i + 1} value={i + 1}>{name}</option>
                ))}
            </select>
          </div>
        )}

        {/* Season Selection (only for seasonal time scale) */}
        {timeScale === 'seasonal' && (
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Season:</label>
            <select 
              value={season} 
              onChange={(e) => handleSeasonChange(e.target.value)}
              style={{ width: '100%', padding: '5px' }}
            >
              <option value="winter">Winter</option>
              <option value="spring">Spring</option>
              <option value="summer">Summer</option>
              <option value="fall">Fall</option>
            </select>
          </div>
        )}

        <button 
          onClick={handleSubmit}
          style={{
            width: '100%',
            padding: '8px',
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Update Map'}
        </button>

        {pendingUpdate && (
          <div style={{ 
            marginTop: '8px', 
            fontSize: '0.8em', 
            color: '#666',
            fontStyle: 'italic'
          }}>
            Changes pending. Click "Update Map" to apply.
          </div>
        )}
      </div>

      {/* Metric Selection */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        backgroundColor: 'white',
        padding: '15px',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        zIndex: 1,
        minWidth: '200px'
      }}>
        <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>PM2.5 Metric</div>
        
        {['avg_total', 'avg_fire', 'avg_nonfire', 'max_total', 'max_fire'].map(metric => (
          <label key={metric} style={{ display: 'block', marginBottom: '8px' }}>
            <input
              type="radio"
              name="metric"
              checked={activeMetric === metric}
              onChange={() => handleMetricChange(metric)}
              style={{ marginRight: '8px' }}
            />
            {getMetricLabel(metric)}
          </label>
        ))}
      </div>

      {/* Legend */}
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          backgroundColor: 'white',
          padding: '15px',
          borderRadius: '4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          zIndex: 1,
          minWidth: '180px'
        }}
      >
        <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>
          {getMetricLabel()} (μg/m³)
        </div>
        {getColorScale(choroplethData).map(([value, color], i, arr) => {
          const label = i === arr.length - 1
            ? `${value.toFixed(1)}+`
            : `${value.toFixed(1)} - ${arr[i + 1][0].toFixed(1)}`;

          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
              <div style={{
                width: '20px',
                height: '15px',
                backgroundColor: color,
                marginRight: '8px',
                border: '1px solid #999'
              }}></div>
              <span style={{ fontSize: '0.9em' }}>{label}</span>
            </div>
          );
        })}
      </div>

      {loading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(255,255,255,0.8)',
          zIndex: 2
        }}>
          <div style={{ 
            padding: '20px',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
          }}>
            Loading map data...
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to get metric label (outside component for reuse)
const getMetricLabel = (metric) => {
  const labels = {
    'avg_total': 'Average Total PM2.5',
    'avg_fire': 'Average Fire PM2.5',
    'avg_nonfire': 'Average Non-fire PM2.5',
    'max_total': 'Maximum Total PM2.5',
    'max_fire': 'Maximum Fire PM2.5'
  };
  return labels[metric] || 'PM2.5';
};

export default React.memo(Map);