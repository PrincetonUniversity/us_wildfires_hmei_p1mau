import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { createRoot } from 'react-dom/client';
import CountyBarChart from './CountyBarChart';
import DateRangeSelector from './DateRangeSelector';
import { format } from 'date-fns';
import { Typography } from '@mui/material';

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

const Map = ({ mapboxToken, stateAbbr }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeLayer, setActiveLayer] = useState('avg_total_pm25');
  const [activePm25Type, setActivePm25Type] = useState('total'); // 'total', 'fire', or 'nonfire'
  const [startDate, setStartDate] = useState(new Date('2021-01-01'));
  const [endDate, setEndDate] = useState(new Date('2023-12-31'));
  const [timeScale, setTimeScale] = useState('period');
  const [pendingUpdate, setPendingUpdate] = useState(false);
  const currentCountyRef = useRef(null);

  // Function to fetch data with date range and time scale
  const fetchData = async (start, end, scale) => {
    try {
      let startStr, endStr;

      // Format dates based on time scale
      switch (scale) {
        case 'yearly':
          startStr = format(start, 'yyyy');
          endStr = startStr; // Same year for yearly view
          break;
        case 'monthly':
          // Get the month's start and end dates
          const month = start.getMonth();
          const year = start.getFullYear();
          const monthStart = new Date(year, month, 1);
          const monthEnd = new Date(year, month + 1, 0); // Last day of the month
          startStr = format(monthStart, 'yyyy-MM-dd');
          endStr = format(monthEnd, 'yyyy-MM-dd');
          break;
        case 'seasonal':
          // Get the season's start and end dates
          const season = start.getMonth();
          const seasonYear = start.getFullYear();
          let seasonStart, seasonEnd;

          if (season === 11) { // Winter
            seasonStart = new Date(seasonYear, 11, 1); // December 1
            seasonEnd = new Date(seasonYear + 1, 2, 28); // February 28/29
          } else if (season === 2) { // Spring
            seasonStart = new Date(seasonYear, 2, 1); // March 1
            seasonEnd = new Date(seasonYear, 5, 30); // May 31
          } else if (season === 5) { // Summer
            seasonStart = new Date(seasonYear, 5, 1); // June 1
            seasonEnd = new Date(seasonYear, 8, 30); // August 31
          } else { // Fall
            seasonStart = new Date(seasonYear, 8, 1); // September 1
            seasonEnd = new Date(seasonYear, 11, 30); // November 30
          }

          startStr = format(seasonStart, 'yyyy-MM-dd');
          endStr = format(seasonEnd, 'yyyy-MM-dd');
          break;
        case 'daily':
          startStr = format(start, 'yyyy-MM-dd');
          endStr = startStr; // Same day for daily view
          break;
        case 'period':
        default:
          startStr = format(start, 'yyyy-MM-dd');
          endStr = format(end, 'yyyy-MM-dd');
      }

      const response = await fetch(
        `http://localhost:8000/api/counties?start_date=${startStr}&end_date=${endStr}&time_scale=${scale}`
      );
      if (!response.ok) throw new Error('Failed to fetch PM2.5 data');
      return await response.json();
    } catch (err) {
      console.error('Error fetching data:', err);
      throw err;
    }
  };

  // Handle date changes
  const handleDateChange = (type, newDate) => {
    if (type === 'start') {
      setStartDate(newDate);
      // For yearly and daily views, update end date to match
      if (timeScale === 'yearly' || timeScale === 'daily') {
        setEndDate(newDate);
      }
    } else {
      setEndDate(newDate);
    }
    setPendingUpdate(true);
  };

  // Handle time scale changes
  const handleTimeScaleChange = (newScale) => {
    setTimeScale(newScale);
    // Reset dates based on new time scale
    if (newScale === 'yearly' || newScale === 'daily') {
      setEndDate(startDate);
    }
    setPendingUpdate(true);
  };

  // Handle submit button click
  const handleSubmit = async () => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    try {
      setLoading(true);
      const data = await fetchData(startDate, endDate, timeScale);

      if (map.current.getSource('pm25')) {
        map.current.getSource('pm25').setData(data);
      }
      setPendingUpdate(false);
    } catch (err) {
      console.error('Error updating map data:', err);
    } finally {
      setLoading(false);
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
        const data = await fetchData(startDate, endDate, timeScale);

        // Filter out Puerto Rico counties and calculate nonfire_pm25 if needed
        const filteredData = {
          ...data,
          features: data.features.map(feature => {
            const fips = feature.properties.GEOID || feature.properties.FIPS;
            // Skip Puerto Rico counties
            if (fips?.toString().startsWith('72')) return null;
            
            // Calculate nonfire_pm25 if not present
            const props = { ...feature.properties };
            if (props.avg_total_pm25 !== undefined && props.fire_pm25 !== undefined) {
              props.nonfire_pm25 = Math.max(0, props.avg_total_pm25 - (props.fire_pm25 || 0));
            }
            
            return {
              ...feature,
              properties: props
            };
          }).filter(Boolean) // Remove null entries (Puerto Rico)
        };

        // Add source and layer
        if (map.current) {
          map.current.addSource('pm25', {
            type: 'geojson',
            data: filteredData,
            generateId: true
          });

          // Helper function to get the appropriate color scale based on PM2.5 type
          const getColorScale = (type) => {
            switch(type) {
              case 'fire':
                return PM25_COLORS_FIRE;
              case 'nonfire':
                return PM25_COLORS_TOTAL; // Same as total for consistency
              case 'total':
              default:
                return PM25_COLORS_TOTAL;
            }
          };

          // Add the fill layer for PM2.5
          map.current.addLayer({
            id: 'pm25-layer',
            type: 'fill',
            source: 'pm25',
            paint: {
              'fill-color': [
                'interpolate',
                ['linear'],
                ['get', activeLayer === 'avg_population' ? 'avg_population' : 
                  activePm25Type === 'fire' ? 'fire_pm25' : 
                  activePm25Type === 'nonfire' ? 'nonfire_pm25' : 'avg_total_pm25'],
                ...(activeLayer === 'avg_population' ? POPULATION_COLORS : 
                   activePm25Type === 'fire' ? PM25_COLORS_FIRE : PM25_COLORS_TOTAL)
                  .reduce((acc, [value, color]) => acc.concat(value, color), [])
              ],
              'fill-opacity': 0.8,
              'fill-outline-color': 'rgba(0,0,0,0.2)'
            }
          });

          // Add hover effect
          map.current.on('mousemove', 'pm25-layer', (e) => {
            if (e.features.length > 0) {
              const feature = e.features[0];
              const props = feature.properties;
              const countyId = props.GEOID || props.FIPS;

              // Only update if we're hovering over a different county
              if (currentCountyRef.current !== countyId) {
                currentCountyRef.current = countyId;

                // Debug: Log all available properties
                console.log('Available properties:', Object.keys(props).sort());
                
                // Prepare chart data for 2013–2023
                const chartData = [];
                console.log('All properties for this county:', props);
                
                // Log all PM2.5 related properties
                const pm25Props = Object.keys(props).filter(key => key.startsWith('pm25_'));
                console.log('All PM2.5 properties:', pm25Props);
                
                for (let year = 2013; year <= 2023; year++) {
                  // Get all possible property names for this year
                  const totalKey = `pm25_${year}_total`;
                  const fireKey = `pm25_${year}_fire`;
                  const nonfireKey = `pm25_${year}_nonfire`;
                  
                  // Log raw values before any processing
                  console.log(`\nYear ${year} raw values:`, {
                    [totalKey]: props[totalKey],
                    [fireKey]: props[fireKey],
                    [nonfireKey]: props[nonfireKey]
                  });
                  
                  // Get values with debug logging
                  const total = Number(props[totalKey] || 0);
                  const fire = Number(props[fireKey] || 0);
                  const nonfire = Number(props[nonfireKey] || (total - fire));
                  
                  // Ensure values are valid and non-negative
                  const validFire = Math.max(0, fire);
                  const validNonFire = Math.max(0, nonfire);
                  
                  // Debug log the values
                  console.log(`Year ${year} processed values:`, { 
                    total, 
                    fire, 
                    nonfire,
                    validFire,
                    validNonFire,
                    totalExists: totalKey in props,
                    fireExists: fireKey in props,
                    nonfireExists: nonfireKey in props
                  });

                  chartData.push({
                    year,
                    fire: validFire,
                    nonFire: validNonFire
                  });
                }
                
                console.log('Final chart data:', chartData);

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

                // Add PM2.5 values
                const valuesDiv = document.createElement('div');
                valuesDiv.style.marginBottom = '8px';
                valuesDiv.style.fontSize = '0.9em';
                const totalPm25 = props.avg_total_pm25 || 0;
                const firePm25 = props.fire_pm25 || 0;
                const nonfirePm25 = props.nonfire_pm25 || Math.max(0, totalPm25 - firePm25);
                
                valuesDiv.innerHTML = `
                  <div>Population: ${props.avg_population?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || 'N/A'}</div>
                  <div>Total PM2.5: ${totalPm25.toFixed(2)} µg/m³</div>
                  <div>Fire PM2.5: ${firePm25.toFixed(2)} µg/m³ (${(firePm25 / (totalPm25 || 1) * 100).toFixed(1)}%)</div>
                  <div>Non-fire PM2.5: ${nonfirePm25.toFixed(2)} µg/m³ (${(nonfirePm25 / (totalPm25 || 1) * 100).toFixed(1)}%)</div>
                `;
                popupNode.appendChild(valuesDiv);

                // Render chart
                const chartDiv = document.createElement('div');
                chartDiv.style.width = '350px';
                chartDiv.style.height = '180px';
                popupNode.appendChild(chartDiv);
                const root = createRoot(chartDiv);
                root.render(<CountyBarChart data={chartData} />);

                map.current.getCanvas().style.cursor = 'pointer';
                popup
                  .setLngLat(e.lngLat)
                  .setDOMContent(popupNode)
                  .addTo(map.current);
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
            currentCountyRef.current = null;  // Reset current county
          });

          // Set loading to false when data is loaded
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading PM2.5 data:', err);
        setError('Failed to load PM2.5 data');
      } finally {
        setLoading(false);
      }
    });

    // Cleanup
    return () => {
      if (map.current) {
        // Remove event listeners
        if (map.current.loaded()) {
          map.current.off('mousemove', 'pm25-layer');
          map.current.off('mouseleave', 'pm25-layer');
        }
        // Remove popup
        if (popup.isOpen()) {
          popup.remove();
        }
        // Remove map
        map.current.remove();
        map.current = null;
      }
    };
  }, [mapboxToken, stateAbbr]);

  // Update layer when activeLayer or activePm25Type changes
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded() || !map.current.getLayer('pm25-layer')) {
      return;
    }

    // Determine the field name based on the selected layer type
    let fieldName;
    let colors;
    
    if (activeLayer === 'avg_population') {
      fieldName = 'avg_population';
      colors = POPULATION_COLORS;
    } else {
      // For PM2.5 layers, determine which field to use based on activePm25Type
      fieldName = activePm25Type === 'fire' ? 'fire_pm25' : 
                activePm25Type === 'nonfire' ? 'nonfire_pm25' : 'avg_total_pm25';
      colors = activePm25Type === 'fire' ? PM25_COLORS_FIRE : PM25_COLORS_TOTAL;
    }

    // Create the paint stops for the color scale
    const paintStops = colors.reduce((acc, [value, color]) => acc.concat(value, color), []);

    // Update the map layer
    map.current.setPaintProperty('pm25-layer', 'fill-color', [
      'interpolate',
      ['linear'],
      ['get', fieldName],
      ...paintStops
    ]);

    // Update the legend title
    const legendEl = document.getElementById('pm25-legend');
    if (legendEl) {
      const titleEl = legendEl.querySelector('div:first-child');
      if (titleEl) {
        let title = '';
        if (activeLayer === 'avg_population') {
          title = 'Population';
        } else {
          const typeMap = {
            'total': 'Total PM2.5',
            'fire': 'Fire PM2.5',
            'nonfire': 'Non-fire PM2.5'
          };
          title = `${typeMap[activePm25Type]} (μg/m³)`;
        }
        titleEl.textContent = title;
      }
    }
  }, [activeLayer, activePm25Type]);

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

      {/* Date Range Selector */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        backgroundColor: 'white',
        padding: '10px',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        zIndex: 1
      }}>
        <DateRangeSelector
          startDate={startDate}
          endDate={endDate}
          onDateChange={handleDateChange}
          onSubmit={handleSubmit}
          timeScale={timeScale}
          onTimeScaleChange={handleTimeScaleChange}
        />
        {pendingUpdate && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Changes pending. Click "Update Map" to apply.
          </Typography>
        )}
      </div>

      {/* Layer Toggle */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        backgroundColor: 'white',
        padding: '10px',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        zIndex: 1,
        width: '200px'
      }}>
        <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>Map Layer</div>
        
        {/* Data Type Selection */}
        <div style={{ marginBottom: '10px' }}>
          <div style={{ marginBottom: '5px', fontWeight: '500' }}>Data Type:</div>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            <input
              type="radio"
              name="dataType"
              checked={activeLayer === 'avg_total_pm25'}
              onChange={() => setActiveLayer('avg_total_pm25')}
              style={{ marginRight: '5px' }}
            />
            PM2.5
          </label>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            <input
              type="radio"
              name="dataType"
              checked={activeLayer === 'avg_population'}
              onChange={() => setActiveLayer('avg_population')}
              style={{ marginRight: '5px' }}
            />
            Population
          </label>
        </div>

        {/* PM2.5 Type Selection (only shown when PM2.5 is selected) */}
        {activeLayer !== 'avg_population' && (
          <div style={{ marginTop: '10px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
            <div style={{ marginBottom: '5px', fontWeight: '500' }}>PM2.5 Type:</div>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              <input
                type="radio"
                name="pm25Type"
                checked={activePm25Type === 'total'}
                onChange={() => setActivePm25Type('total')}
                style={{ marginRight: '5px' }}
              />
              Total
            </label>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              <input
                type="radio"
                name="pm25Type"
                checked={activePm25Type === 'fire'}
                onChange={() => setActivePm25Type('fire')}
                style={{ marginRight: '5px' }}
              />
              Fire
            </label>
            <label style={{ display: 'block' }}>
              <input
                type="radio"
                name="pm25Type"
                checked={activePm25Type === 'nonfire'}
                onChange={() => setActivePm25Type('nonfire')}
                style={{ marginRight: '5px' }}
              />
              Non-fire
            </label>
          </div>
        )}
      </div>

      {/* Legend */}
      <div
        id="pm25-legend"
        style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          backgroundColor: 'white',
          padding: '10px',
          borderRadius: '4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          zIndex: 1,
          minWidth: '150px'
        }}
      >
        <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
          {activeLayer === 'avg_population' ? 'Population' : 
           `${activePm25Type === 'total' ? 'Total' : activePm25Type === 'fire' ? 'Fire' : 'Non-fire'} PM2.5 (μg/m³)`}
        </div>
        {(() => {
          // Determine which color scale to use based on the active layer and PM2.5 type
          const colors = activeLayer === 'avg_population' 
            ? POPULATION_COLORS 
            : activePm25Type === 'fire' 
              ? PM25_COLORS_FIRE 
              : PM25_COLORS_TOTAL;

          // Special handling for population values (show full numbers)
          if (activeLayer === 'avg_population') {
            return colors.map(([value, color], i, arr) => {
              const label = i === arr.length - 1
                ? `${value.toLocaleString()}+`
                : `${value.toLocaleString()} - ${arr[i + 1][0].toLocaleString()}`;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
                  <div style={{
                    width: '20px',
                    height: '15px',
                    backgroundColor: color,
                    marginRight: '5px',
                    border: '1px solid #999'
                  }}></div>
                  <span>{label}</span>
                </div>
              );
            });
          }
          
          // For PM2.5 values (show with one decimal place)
          return colors.map(([value, color], i, arr) => {
            const label = i === arr.length - 1
              ? `${value.toFixed(1)}+`
              : `${value.toFixed(1)} - ${arr[i + 1][0].toFixed(1)}`;

            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
                <div style={{
                  width: '20px',
                  height: '15px',
                  backgroundColor: color,
                  marginRight: '5px',
                  border: '1px solid #999'
                }}></div>
                <span>{label} {activeLayer !== 'avg_population' ? '' : ''}</span>
              </div>
            );
          });
        })()}
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
          backgroundColor: 'rgba(255,255,255,0.7)',
          zIndex: 2
        }}>
          <div>Loading map data...</div>
        </div>
      )}
    </div>
  );
};

export default React.memo(Map);
