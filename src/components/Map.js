import React, { useRef, useEffect, useState, useCallback } from 'react';
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

const Map = ({ mapboxToken }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeLayer, setActiveLayer] = useState('avg_total_pm25');

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
        -125.0,  // West
        24.0,    // South
        -66.0,   // East
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
      maxWidth: '300px'
    });

    // Load PM2.5 data when map is ready
    map.current.on('load', async () => {
      try {
        const response = await fetch('http://localhost:8000/api/counties');
        if (!response.ok) throw new Error('Failed to fetch PM2.5 data');

        const data = await response.json();

        // Add source and layer
        if (map.current) {
          map.current.addSource('pm25', {
            type: 'geojson',
            data: data,
            generateId: true
          });

          map.current.addLayer({
            id: 'pm25-layer',
            type: 'fill',
            source: 'pm25',
            paint: {
              'fill-color': [
                'interpolate',
                ['linear'],
                ['get', activeLayer],
                ...(activeLayer === 'fire_pm25' ? PM25_COLORS_FIRE : PM25_COLORS_TOTAL).reduce((acc, [value, color]) => acc.concat(value, color), [])
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

              // Prepare chart data for 2021–2023
              const chartData = [2021, 2022, 2023].map(year => {
                // Get the data for this year
                const total = Number(props[`pm25_${year}_total`] || 0);
                const fire = Number(props[`pm25_${year}_fire`] || 0);
                const nonFire = Number(props[`pm25_${year}_nonfire`] || 0);

                // Ensure values are valid
                const validFire = Math.max(0, Math.min(fire, total));
                const validNonFire = Math.max(0, total - validFire);

                return {
                  year,
                  fire: validFire,
                  nonFire: validNonFire
                };
              });

              // Create a DOM node for React rendering
              const popupNode = document.createElement('div');

              // Add county name above chart
              const nameDiv = document.createElement('div');
              nameDiv.style.fontWeight = 'bold';
              nameDiv.style.fontSize = '1.1em';
              nameDiv.style.marginBottom = '8px';
              nameDiv.textContent = props.county_name || props.NAME || 'Unknown County';
              popupNode.appendChild(nameDiv);

              // Add PM2.5 values
              const valuesDiv = document.createElement('div');
              valuesDiv.style.marginBottom = '8px';
              valuesDiv.style.fontSize = '0.9em';
              valuesDiv.innerHTML = `
                <div style="margin-top: 8px; border-top: 1px solid #eee; padding-top: 8px; border-bottom: 1px solid #eee; padding-bottom: 8px;">
                  <div>Average Population (2021-2023): ${props.avg_population?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || 'N/A'}</div>
                </div>
                <div>Total PM2.5: ${props.avg_total_pm25?.toFixed(2) || 0} µg/m³</div>
                <div>Fire PM2.5: ${props.fire_pm25?.toFixed(2) || 0} µg/m³</div>
                <div>Non-fire PM2.5: ${(props.avg_total_pm25 - props.fire_pm25)?.toFixed(2) || 0} µg/m³</div>
              `;
              popupNode.appendChild(valuesDiv);

              // Render chart
              const chartDiv = document.createElement('div');
              chartDiv.style.width = '250px';
              chartDiv.style.height = '180px';
              popupNode.appendChild(chartDiv);
              const root = createRoot(chartDiv);
              root.render(<CountyBarChart data={chartData} />);

              map.current.getCanvas().style.cursor = 'pointer';
              popup
                .setLngLat(e.lngLat)
                .setDOMContent(popupNode)
                .addTo(map.current);
            }
          });

          // Change the cursor back to a pointer when it leaves the layer
          map.current.on('mouseleave', 'pm25-layer', () => {
            map.current.getCanvas().style.cursor = '';
            popup.remove();
          });

          // Set loading to false when data is loaded
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading PM2.5 data:', err);
        setError('Failed to load PM2.5 data');
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
  }, [mapboxToken]);

  // Update layer when activeLayer changes
  useEffect(() => {
    if (map.current && map.current.isStyleLoaded() && map.current.getLayer('pm25-layer')) {
      const isFireLayer = activeLayer === 'fire_pm25';
      const currentColors = isFireLayer ? PM25_COLORS_FIRE : PM25_COLORS_TOTAL;
      const paintStops = currentColors.reduce((acc, [value, color]) => acc.concat(value, color), []);

      map.current.setPaintProperty('pm25-layer', 'fill-color', [
        'interpolate',
        ['linear'],
        ['get', activeLayer],
        ...paintStops
      ]);

      // Update the legend title
      const legendEl = document.getElementById('pm25-legend');
      if (legendEl) {
        const titleEl = legendEl.querySelector('div:first-child');
        if (titleEl) {
          titleEl.textContent = `PM2.5 ${isFireLayer ? '(Fire-related)' : '(Total)'} (μg/m³)`;
        }
      }
    }
  }, [activeLayer]);

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

      {/* Layer Toggle */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        backgroundColor: 'white',
        padding: '10px',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        zIndex: 1
      }}>
        <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>PM2.5 Layer</div>
        <label style={{ display: 'block', marginBottom: '5px' }}>
          <input
            type="radio"
            name="layer"
            checked={activeLayer === 'avg_total_pm25'}
            onChange={() => setActiveLayer('avg_total_pm25')}
            style={{ marginRight: '5px' }}
          />
          Total PM2.5
        </label>
        <label style={{ display: 'block' }}>
          <input
            type="radio"
            name="layer"
            checked={activeLayer === 'fire_pm25'}
            onChange={() => setActiveLayer('fire_pm25')}
            style={{ marginRight: '5px' }}
          />
          Fire-related PM2.5
        </label>
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
          PM2.5 {activeLayer === 'avg_total_pm25' ? '(Total)' : '(Fire-related)'} (μg/m³)
        </div>
        {(activeLayer === 'fire_pm25' ? PM25_COLORS_FIRE : PM25_COLORS_TOTAL).map(([value, color], i, arr) => {
          const label = (i === arr.length - 1) ? `${value}+` : `${value} - ${arr[i + 1][0]}`;
          if (i < arr.length - 1) { // Display N-1 ranges
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
                <div style={{
                  width: '20px',
                  height: '15px',
                  backgroundColor: color,
                  marginRight: '5px',
                  border: '1px solid #999'
                }}></div>
                <span>{`${value} - ${arr[i + 1][0]}`}</span>
              </div>
            );
          } else if (i === arr.length - 1) { // Display the last item as X+
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
                <div style={{
                  width: '20px',
                  height: '15px',
                  backgroundColor: color,
                  marginRight: '5px',
                  border: '1px solid #999'
                }}></div>
                <span>{`${value}+`}</span>
              </div>
            );
          }
          return null;
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
