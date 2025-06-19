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

// Color scale for population-weighted PM2.5 values (purple to blue)
const POP_WEIGHTED_COLORS = [
  [0, '#f7f4f9'],      // very light purple
  [1000000, '#e7e1ef'], // light purple
  [5000000, '#d4b9da'], // purple
  [10000000, '#c994c7'], // medium purple
  [25000000, '#df65b0'], // pink
  [50000000, '#e7298a']  // dark pink
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
    // fallback to static scale for the metric
    if (metric.includes('pop_weighted')) return POP_WEIGHTED_COLORS;
    if (metric.includes('fire') && !metric.includes('nonfire')) return PM25_COLORS_FIRE;
    return PM25_COLORS_TOTAL;
  }

  // Extract all values for the current metric
  const values = data.features
    .map(feature => feature.properties[metric] || 0)
    .filter(val => val > 0) // Remove zero values
    .sort((a, b) => a - b);

  if (values.length === 0) {
    if (metric.includes('pop_weighted')) return POP_WEIGHTED_COLORS;
    if (metric.includes('fire') && !metric.includes('nonfire')) return PM25_COLORS_FIRE;
    return PM25_COLORS_TOTAL;
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
  const [activeMetric, setActiveMetric] = useState('average'); // default to 'average'
  const [timeScale, setTimeScale] = useState('yearly');
  const [year, setYear] = useState(2023);
  const [month, setMonth] = useState(1); // 1-12
  const [season, setSeason] = useState('winter');
  const [pendingUpdate, setPendingUpdate] = useState(false);
  const [choroplethData, setChoroplethData] = useState(null);
  const currentCountyRef = useRef(null);
  const [subMetric, setSubMetric] = useState('total'); // default to 'total'

  // Function to update the legend based on the current metric and data
  const updateLegend = () => {
    if (!map.current) return;

    const legend = document.getElementById('legend');
    if (!legend) return;

    const colorScale = getColorScale(choroplethData) || [];
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

  // Helper to get the property name for the current metric and sub-metric
  const getMetricProperty = () => {
    if (activeMetric === 'average') {
      if (subMetric === 'total') return 'avg_total';
      if (subMetric === 'fire') return 'avg_fire';
      if (subMetric === 'nonfire') return 'avg_nonfire';
    } else if (activeMetric === 'max') {
      if (subMetric === 'total') return 'max_total';
      if (subMetric === 'fire') return 'max_fire';
      if (subMetric === 'nonfire') return 'max_nonfire';
    } else if (activeMetric === 'pop_weighted') {
      if (subMetric === 'total') return 'pop_weighted_total';
      if (subMetric === 'fire') return 'pop_weighted_fire';
      if (subMetric === 'nonfire') return 'pop_weighted_nonfire';
    }
    return 'avg_total';
  };

  // Function to fetch choropleth data with new API
  const fetchChoroplethData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        time_scale: timeScale,
        ...(year && { year: year.toString() }),
        ...(timeScale === 'monthly' && month && { month: month.toString() }),
        ...(timeScale === 'seasonal' && season && { season }),
        sub_metric: subMetric // Always send sub_metric
      });
      let endpoint = '/api/counties/choropleth/average';
      if (activeMetric === 'max') endpoint = '/api/counties/choropleth/max';
      if (activeMetric === 'pop_weighted') endpoint = '/api/counties/choropleth/pop_weighted';
      const response = await fetch(`http://localhost:8000${endpoint}?${params}`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch choropleth data: ${response.status} ${response.statusText}\n${errorText}`);
      }
      const data = await response.json();
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
  const fetchBarChartData = async (fips, currentTimeScale = timeScale, currentYear = year, currentMonth = month, currentSeason = season) => {
    try {
      let params = new URLSearchParams();
      let endpoint = `http://localhost:8000/api/pm25/bar_chart/${fips}`;

      console.log('Fetching bar chart data with time scale:', currentTimeScale);

      // Add parameters based on the time scale
      if (currentTimeScale === 'yearly') {
        // For yearly data, show 2013-2023 by default
        params.append('time_scale', 'yearly');
        params.append('start_year', '2013');
        params.append('end_year', '2023');
      } else if (currentTimeScale === 'monthly') {
        // For monthly data, we want daily data for the specific month
        params.append('time_scale', 'daily');
        params.append('year', currentYear.toString());
        params.append('month', currentMonth.toString());
        // Add start and end dates to ensure we only get data for the selected month
        const startDate = new Date(currentYear, currentMonth - 1, 1);
        const endDate = new Date(currentYear, currentMonth, 1); // First day of next month
        params.append('start_date', startDate.toISOString().split('T')[0]);
        params.append('end_date', endDate.toISOString().split('T')[0]);
      } else if (currentTimeScale === 'seasonal') {
        // For seasonal data, we want daily data for the specific season
        params.append('time_scale', 'daily');
        params.append('year', currentYear.toString());
        params.append('season', currentSeason);
        // Add start and end dates for the season
        let startDate, endDate;
        if (currentSeason === 'winter') {
          // Winter: Dec 21 - Mar 20
          startDate = new Date(currentYear - 1, 11, 21); // December 21st of previous year
          endDate = new Date(currentYear, 2, 21); // March 21st
        } else if (currentSeason === 'spring') {
          // Spring: Mar 21 - Jun 20
          startDate = new Date(currentYear, 2, 21); // March 21st
          endDate = new Date(currentYear, 5, 21); // June 21st
        } else if (currentSeason === 'summer') {
          // Summer: Jun 21 - Sep 20
          startDate = new Date(currentYear, 5, 21); // June 21st
          endDate = new Date(currentYear, 8, 21); // September 21st
        } else if (currentSeason === 'fall') {
          // Fall: Sep 21 - Dec 20
          startDate = new Date(currentYear, 8, 21); // September 21st
          endDate = new Date(currentYear, 11, 21); // December 21st
        }
        params.append('start_date', startDate.toISOString().split('T')[0]);
        params.append('end_date', endDate.toISOString().split('T')[0]);
      }

      console.log('Fetching bar chart data with params:', params.toString());
      const response = await fetch(`${endpoint}?${params}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to fetch bar chart data: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Received bar chart data:', data);

      // Ensure data is an array
      if (!Array.isArray(data)) {
        console.error('Expected array but got:', data);
        return [];
      }

      // Transform the data based on time scale
      if (currentTimeScale === 'yearly') {
        return data.map(item => ({
          year: item.year,
          timePeriod: item.year.toString(),
          label: item.year.toString(),
          fire: item.fire || 0,
          nonFire: item.nonfire || item.nonFire || 0,
          total: item.total || 0,
          displayType: 'yearly'
        }));
      } else {
        // For monthly and seasonal data, process daily values
        return data.map(item => {
          const date = new Date(item.date);
          const day = date.getDate();
          const month = date.getMonth() + 1;

          // Create a sort value that ensures December comes first in winter
          let sortValue;
          if (currentTimeScale === 'seasonal' && currentSeason === 'winter') {
            // For winter: December (12) -> 0, January (1) -> 1, February (2) -> 2
            sortValue = month === 12 ? 0 : month;
          } else {
            sortValue = month;
          }

          const monthDay = `${month}/${day}`;

          return {
            date: item.date,
            day: day,
            month: month,
            sortValue: sortValue,
            timePeriod: monthDay,
            label: monthDay,
            fire: item.fire || 0,
            nonFire: item.nonfire || item.nonFire || 0,
            total: item.total || 0,
            displayType: 'daily'
          };
        }).filter(item => {
          // Filter out any data points that don't belong to the selected period
          const itemDate = new Date(item.date);
          const itemMonth = itemDate.getMonth() + 1;
          const itemDay = itemDate.getDate();
          const itemYear = itemDate.getFullYear();

          if (currentTimeScale === 'monthly') {
            return itemMonth === currentMonth && itemYear === currentYear;
          } else if (currentTimeScale === 'seasonal') {
            if (currentSeason === 'winter') {
              // Winter: Dec 21 - Mar 20
              return (itemMonth === 12 && itemDay >= 21 && itemYear === currentYear - 1) ||
                (itemMonth <= 2 && itemYear === currentYear) ||
                (itemMonth === 3 && itemDay <= 20 && itemYear === currentYear);
            } else if (currentSeason === 'spring') {
              // Spring: Mar 21 - Jun 20
              return (itemMonth === 3 && itemDay >= 21 && itemYear === currentYear) ||
                (itemMonth >= 4 && itemMonth <= 5 && itemYear === currentYear) ||
                (itemMonth === 6 && itemDay <= 20 && itemYear === currentYear);
            } else if (currentSeason === 'summer') {
              // Summer: Jun 21 - Sep 20
              return (itemMonth === 6 && itemDay >= 21 && itemYear === currentYear) ||
                (itemMonth >= 7 && itemMonth <= 8 && itemYear === currentYear) ||
                (itemMonth === 9 && itemDay <= 20 && itemYear === currentYear);
            } else if (currentSeason === 'fall') {
              // Fall: Sep 21 - Dec 20
              return (itemMonth === 9 && itemDay >= 21 && itemYear === currentYear) ||
                (itemMonth >= 10 && itemMonth <= 11 && itemYear === currentYear) ||
                (itemMonth === 12 && itemDay <= 20 && itemYear === currentYear);
            }
          }
          return true;
        }).sort((a, b) => {
          if (currentTimeScale === 'seasonal' && currentSeason === 'winter') {
            // For winter, sort by sortValue first, then by day
            if (a.sortValue !== b.sortValue) {
              return a.sortValue - b.sortValue;
            }
            return a.day - b.day;
          }
          // For other cases, sort by date
          return new Date(a.date) - new Date(b.date);
        });
      }
    } catch (err) {
      console.error('Error in fetchBarChartData:', err);
      return [];
    }
  };

  // Handle time scale changes
  const handleTimeScaleChange = (newScale) => {
    console.log('Time scale changed to:', newScale);
    setTimeScale(newScale);
    setPendingUpdate(true);

    // Reset month/season when changing time scale
    if (newScale === 'yearly') {
      setMonth(1);
      setSeason('winter');
    } else if (newScale === 'monthly') {
      setSeason('winter');
    } else if (newScale === 'seasonal') {
      setMonth(1);
    }
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

      // If there's a current county being hovered, refresh its bar chart
      if (currentCountyRef.current) {
        const barChartData = await fetchBarChartData(
          currentCountyRef.current,
          timeScale,
          year,
          month,
          season
        );

        // Update the popup with new bar chart data
        const popup = map.current.getPopup();
        if (popup.isOpen()) {
          const popupNode = popup.getElement();
          const chartDiv = popupNode.querySelector('div[style*="width: 350px"], div[style*="width: 400px"]');
          if (chartDiv) {
            const root = createRoot(chartDiv);
            root.render(<CountyBarChart data={barChartData} timeScale={timeScale} />);
          }
        }
      }
    } catch (err) {
      console.error('Error updating map data:', err);
      setError('Failed to update map data: ' + err.message);
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
      maxWidth: 'none' // Remove maxWidth constraint
    });

    // Load initial data when map is ready
    map.current.on('load', async () => {
      try {
        const data = await fetchChoroplethData();

        // Add source and layer
        if (map.current) {
          if (!map.current.getSource('pm25')) {
            map.current.addSource('pm25', {
              type: 'geojson',
              data: data,
              generateId: true
            });
          } else {
            map.current.getSource('pm25').setData(data);
          }

          // Add the fill layer for PM2.5
          const metricForColor = getMetricProperty();
          map.current.addLayer({
            id: 'pm25-layer',
            type: 'fill',
            source: 'pm25',
            paint: {
              'fill-color': [
                'interpolate',
                ['linear'],
                ['get', metricForColor],
                ...getColorScale(choroplethData).reduce((acc, [value, color]) => acc.concat(value, color), [])
              ],
              'fill-opacity': 0.8,
              'fill-outline-color': 'rgba(0,0,0,0.2)'
            }
          });

          // Remove any existing mousemove handler
          map.current.off('mousemove');

          // Add new mousemove handler with current state values
          map.current.on('mousemove', async (e) => {
            // Check if we're over a county feature
            const features = map.current.queryRenderedFeatures(e.point, { layers: ['pm25-layer'] });

            if (features.length > 0) {
              const feature = features[0];
              const props = feature.properties;
              const countyId = props.GEOID || props.FIPS || props.fips;

              // Only update if we're hovering over a different county
              if (currentCountyRef.current !== countyId) {
                // Remove existing popup when changing counties
                popup.remove();
                currentCountyRef.current = countyId;
                map.current.getCanvas().style.cursor = 'pointer';

                try {
                  console.log('Current time scale parameters:', {
                    timeScale,
                    year,
                    month,
                    season
                  });

                  // Fetch bar chart data for this county with current time scale parameters
                  const barChartData = await fetchBarChartData(
                    countyId,
                    timeScale,
                    year,
                    month,
                    season
                  );

                  // Create a DOM node for React rendering
                  const popupNode = document.createElement('div');
                  popupNode.style.padding = '10px';

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
                  const currentValue = props[getMetricProperty()] || 0;
                  const formattedValue = currentValue.toFixed(2);

                  // Create a more informative display
                  valuesDiv.innerHTML = `
                    <div style="margin-bottom: 5px;">
                      <strong>Current Value:</strong> ${formattedValue} ${activeMetric.includes('pop_weighted') ? 'person-µg/m³' : 'µg/m³'}
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
                    ${activeMetric.includes('pop_weighted') ? `
                    <div style="display: flex; margin-bottom: 3px;">
                      <span>Pop-weighted Total:</span> 
                      <span style="margin-left: 8px;">${(props.pop_weighted_total || 0).toLocaleString()} person-µg/m³</span>
                    </div>
                    <div style="display: flex; margin-bottom: 3px;">
                      <span>Pop-weighted Fire:</span> 
                      <span style="margin-left: 8px;">${(props.pop_weighted_fire || 0).toLocaleString()} person-µg/m³</span>
                    </div>
                    <div style="display: flex; margin-bottom: 3px;">
                      <span>Pop-weighted Non-fire:</span> 
                      <span style="margin-left: 8px;">${(props.pop_weighted_nonfire || 0).toLocaleString()} person-µg/m³</span>
                    </div>
                    ` : ''}
                    ${props.population ? `
                    <div style="margin-top: 8px; padding-top: 5px; border-top: 1px solid #eee;">
                      <strong>Population:</strong> ${props.population.toLocaleString()}
                    </div>` : ''}
                  `;
                  popupNode.appendChild(valuesDiv);

                  // Render chart if data is available
                  if (barChartData && barChartData.length > 0) {
                    const chartDiv = document.createElement('div');
                    // Calculate chart width based on time scale
                    const chartWidth = timeScale === 'yearly' ? 350 :
                      timeScale === 'monthly' ? Math.max(350, barChartData.length * 8) :
                        Math.min(400, Math.max(350, barChartData.length * 5)); // Cap seasonal width at 400px

                    chartDiv.style.width = `${chartWidth}px`;
                    chartDiv.style.height = '180px';
                    if (timeScale !== 'yearly') {
                      chartDiv.style.overflowX = 'auto';
                    }
                    popupNode.appendChild(chartDiv);
                    const root = createRoot(chartDiv);
                    root.render(<CountyBarChart data={barChartData} timeScale={timeScale} />);
                  }

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
                  valueDiv.textContent = `${getMetricLabel()}: ${(props[getMetricProperty()] || 0).toFixed(2)} ${activeMetric.includes('pop_weighted') ? 'person-µg/m³' : 'µg/m³'}`;
                  popupNode.appendChild(valueDiv);

                  popup
                    .setLngLat(e.lngLat)
                    .setDOMContent(popupNode)
                    .addTo(map.current);
                }
              } else {
                // Same county, just update popup position
                if (popup.isOpen()) {
                  popup.setLngLat(e.lngLat);
                }
              }
            } else {
              // No county feature found, remove popup and reset state
              if (currentCountyRef.current !== null) {
                popup.remove();
                map.current.getCanvas().style.cursor = '';
                currentCountyRef.current = null;
              }
            }
          });

          // Change the cursor back to a pointer when it leaves the layer
          map.current.on('mouseleave', 'pm25-layer', () => {
            map.current.getCanvas().style.cursor = '';
            popup.remove();
            currentCountyRef.current = null;
          });

          // Also handle when mouse leaves the map entirely
          map.current.on('mouseleave', () => {
            popup.remove();
            currentCountyRef.current = null;
          });

          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading PM2.5 data:', err);
        setError('Failed to load PM2.5 data');
        setLoading(false);
      }
    });

    // Cleanup
    return () => {
      if (map.current) {
        if (map.current.loaded()) {
          map.current.off('mousemove');
          map.current.off('mouseleave', 'pm25-layer');
          map.current.off('mouseleave');
        }
        if (popup.isOpen()) {
          popup.remove();
        }
        map.current.remove();
        map.current = null;
      }
    };
  }, [mapboxToken, stateAbbr, timeScale, year, month, season]);

  // Helper function to get color scale based on metric
  const getColorScale = (data = null) => {
    const metric = getMetricProperty();
    // If we have data, calculate dynamic scale
    if (data) {
      return calculateDynamicColorScale(data, metric);
    }

    // Fallback to static scales
    if (metric.includes('pop_weighted')) {
      return POP_WEIGHTED_COLORS;
    } else if (metric.includes('fire') && !metric.includes('nonfire')) {
      return PM25_COLORS_FIRE;
    }
    return PM25_COLORS_TOTAL;
  };

  // Helper function to get metric label
  const getMetricLabel = (metric = getMetricProperty()) => {
    const labels = {
      'avg_total': 'Average Total PM2.5',
      'avg_fire': 'Average Fire PM2.5',
      'avg_nonfire': 'Average Non-fire PM2.5',
      'max_total': 'Maximum Total PM2.5',
      'max_fire': 'Maximum Fire PM2.5',
      'pop_weighted_total': 'Population-Weighted Total PM2.5',
      'pop_weighted_fire': 'Population-Weighted Fire PM2.5',
      'pop_weighted_nonfire': 'Population-Weighted Non-fire PM2.5'
    };
    return labels[metric] || 'PM2.5';
  };

  // Update map layers when choroplethData, activeMetric, or subMetric changes
  useEffect(() => {
    if (!map.current || !choroplethData) return;

    const mapInstance = map.current;
    const metricForColor = getMetricProperty();

    // Remove the layer if it exists
    if (mapInstance.getLayer('pm25-layer')) {
      mapInstance.removeLayer('pm25-layer');
    }
    // Add or update the source
    if (!mapInstance.getSource('pm25')) {
      mapInstance.addSource('pm25', {
        type: 'geojson',
        data: choroplethData,
        generateId: true
      });
    } else {
      mapInstance.getSource('pm25').setData(choroplethData);
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
          ['get', metricForColor],
          ...getColorScale(choroplethData).reduce((acc, [value, color]) => acc.concat(value, color), [])
        ],
        'fill-opacity': 0.8,
        'fill-outline-color': 'rgba(0,0,0,0.2)'
      }
    }, 'waterway-label');

    // Update the legend
    updateLegend();

  }, [choroplethData, activeMetric, subMetric]);

  // Refetch choropleth data when main metric, time params, or subMetric change
  useEffect(() => {
    fetchChoroplethData();
    // eslint-disable-next-line
  }, [activeMetric, timeScale, year, month, season, subMetric]);

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
            {Array.from({ length: 11 }, (_, i) => 2013 + i).map(y => (
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
        minWidth: '200px',
        marginBottom: '10px'
      }}>
        <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>PM2.5 Metric</div>
        <label style={{ display: 'block', marginBottom: '8px' }}>
          <input
            type="radio"
            name="metric"
            checked={activeMetric === 'average'}
            onChange={() => {
              setActiveMetric('average');
              setSubMetric('total');
            }}
            style={{ marginRight: '8px' }}
          />
          Average
        </label>
        <label style={{ display: 'block', marginBottom: '8px' }}>
          <input
            type="radio"
            name="metric"
            checked={activeMetric === 'max'}
            onChange={() => {
              setActiveMetric('max');
              setSubMetric('total');
            }}
            style={{ marginRight: '8px' }}
          />
          Maximum
        </label>
        <label style={{ display: 'block', marginBottom: '8px' }}>
          <input
            type="radio"
            name="metric"
            checked={activeMetric === 'pop_weighted'}
            onChange={() => {
              setActiveMetric('pop_weighted');
              setSubMetric('total');
            }}
            style={{ marginRight: '8px' }}
          />
          Population-Weighted
        </label>
      </div>

      {/* Sub-metric Selector Box */}
      <div style={{
        position: 'absolute',
        top: '200px', // below the metric box
        right: '20px',
        backgroundColor: 'white',
        padding: '15px',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        zIndex: 1,
        minWidth: '200px'
      }}>
        <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>PM 2.5 Type</div>
        <label style={{ display: 'block', marginBottom: '4px' }}>
          <input
            type="radio"
            name="subMetric"
            checked={subMetric === 'total'}
            onChange={() => setSubMetric('total')}
            style={{ marginRight: '6px' }}
          />
          Total
        </label>
        <label style={{ display: 'block', marginBottom: '4px' }}>
          <input
            type="radio"
            name="subMetric"
            checked={subMetric === 'fire'}
            onChange={() => setSubMetric('fire')}
            style={{ marginRight: '6px' }}
          />
          Fire
        </label>
        <label style={{ display: 'block', marginBottom: '4px' }}>
          <input
            type="radio"
            name="subMetric"
            checked={subMetric === 'nonfire'}
            onChange={() => setSubMetric('nonfire')}
            style={{ marginRight: '6px' }}
          />
          Non-fire
        </label>
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
          {getMetricLabel()} ({activeMetric.includes('pop_weighted') ? 'person-μg/m³' : 'μg/m³'})
        </div>
        {getColorScale(choroplethData).map(([value, color], i, arr) => {
          const label = i === arr.length - 1
            ? `${value.toLocaleString()}+`
            : `${value.toLocaleString()} - ${arr[i + 1][0].toLocaleString()}`;

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

export default React.memo(Map);