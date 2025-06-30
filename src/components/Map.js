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

// Color scale for mortality values (light red to dark red)
const MORTALITY_COLORS = [
  [0.0, '#fee5d9'],      // very light red
  [0.1, '#fcae91'],     // light red
  [0.2, '#fb6a4a'],     // red
  [0.3, '#de2d26'],     // dark red
  [0.4, '#a50f15'],    // very dark red
  [0.5, '#67000d']     // darkest red
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

  // Handle edge case where all values are the same
  if (min === max) {
    if (metric.includes('pop_weighted')) return POP_WEIGHTED_COLORS;
    if (metric.includes('fire') && !metric.includes('nonfire')) return PM25_COLORS_FIRE;
    return PM25_COLORS_TOTAL;
  }

  // Create 6 evenly distributed breakpoints
  const range = max - min;
  const step = range / 5;

  // Base colors (same as existing scales)
  const colors = ['#fff7bc', '#fee391', '#fec44f', '#fe9929', '#ec7014', '#cc4c02'];

  // Generate breakpoints and ensure they are strictly ascending
  const breakpoints = [];
  for (let i = 0; i < colors.length; i++) {
    let value;
    if (i === 0) {
      value = min;
    } else if (i === colors.length - 1) {
      value = max;
    } else {
      value = min + (step * i);
    }

    // Ensure the value is unique and strictly greater than the previous one
    if (breakpoints.length > 0 && value <= breakpoints[breakpoints.length - 1][0]) {
      value = breakpoints[breakpoints.length - 1][0] + 0.1;
    }

    breakpoints.push([value, colors[i]]);
  }

  return breakpoints;
};

const PM25_LAYERS = ['average', 'max', 'pop_weighted'];
const HEALTH_LAYERS = ['mortality', 'population'];

const Map = ({ mapboxToken, stateAbbr, activeLayer, pm25SubLayer, timeControls, onCountySelect, onCountyHover, mapRefreshKey, onMapLoaded, selectedCounty }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const popup = useRef(null); // Persistent popup
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [choroplethData, setChoroplethData] = useState(null);
  const currentCountyRef = useRef(null);

  // Destructure time controls
  const { timeScale, year, month, season } = timeControls;

  // Determine metric and subMetric from new props
  let metric = 'average';
  let subMetric = 'total';
  if (PM25_LAYERS.includes(activeLayer)) {
    metric = activeLayer;
    if (pm25SubLayer) subMetric = pm25SubLayer;
  } else if (HEALTH_LAYERS.includes(activeLayer)) {
    metric = activeLayer;
    if (activeLayer === 'mortality') {
      subMetric = timeControls.subMetric || 'total';
    } else {
      subMetric = 'total';
    }
  }

  // Fetch choropleth data when mapRefreshKey or any relevant prop changes
  useEffect(() => {
    if (!PM25_LAYERS.includes(activeLayer) && !HEALTH_LAYERS.includes(activeLayer)) return;
    let isMounted = true;
    const fetchChoroplethData = async () => {
      try {
        setLoading(true);
        let params = new URLSearchParams();
        let endpoint = '/api/counties/choropleth/average';

        console.log('Fetching choropleth data for layer:', activeLayer);

        if (PM25_LAYERS.includes(activeLayer)) {
          // PM2.5 layers
          params.append('time_scale', timeScale);
          if (year) params.append('year', year.toString());
          if (timeScale === 'monthly' && month) params.append('month', month.toString());
          if (timeScale === 'seasonal' && season) params.append('season', season);
          params.append('sub_metric', subMetric);

          if (metric === 'max') endpoint = '/api/counties/choropleth/max';
          if (metric === 'pop_weighted') endpoint = '/api/counties/choropleth/pop_weighted';
        } else if (HEALTH_LAYERS.includes(activeLayer)) {
          // Health layers
          if (activeLayer === 'mortality') {
            endpoint = '/api/counties/choropleth/mortality';
            params.append('year', year.toString());
            params.append('sub_metric', subMetric);
            console.log('Fetching mortality data for year:', year, 'sub_metric:', subMetric);
          } else if (activeLayer === 'population') {
            endpoint = '/api/counties/choropleth/population';
            params.append('year', year.toString());
            console.log('Fetching population data for year:', year);
          }
          // Add other health layers here as needed
        }

        console.log('Making request to:', `http://localhost:8000${endpoint}?${params}`);
        const response = await fetch(`http://localhost:8000${endpoint}?${params}`);
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch choropleth data: ${response.status} ${response.statusText}\n${errorText}`);
        }
        const data = await response.json();
        console.log('Received choropleth data:', data.features ? `${data.features.length} features` : 'No features');
        if (isMounted) {
          setChoroplethData(data);
          setLoading(false);
          if (onMapLoaded) onMapLoaded();
        }
      } catch (err) {
        console.error('Error fetching choropleth data:', err);
        if (isMounted) {
          setError(err.message);
          setLoading(false);
          if (onMapLoaded) onMapLoaded();
        }
      }
    };
    fetchChoroplethData();
    return () => { isMounted = false; };
  }, [mapRefreshKey, activeLayer, timeScale, year, month, season, pm25SubLayer, subMetric]);

  // Proper cleanup when switching to health layers or timeScale changes
  useEffect(() => {
    if (!map.current) return;
    const legend = document.getElementById('legend');
    if (!PM25_LAYERS.includes(activeLayer) && !HEALTH_LAYERS.includes(activeLayer)) {
      if (legend) legend.style.display = 'none';
    } else {
      if (legend) legend.style.display = 'block';
    }
  }, [activeLayer, timeScale]);

  // Function to update the legend based on the current metric and data
  const updateLegend = () => {
    if (!map.current) return;
    const legend = document.getElementById('legend');
    if (!legend) return;
    // Hide legend for non-mapped layers
    if (!PM25_LAYERS.includes(activeLayer) && !HEALTH_LAYERS.includes(activeLayer)) {
      legend.innerHTML = '';
      legend.style.display = 'none';
      return;
    }
    // Otherwise, show and update legend
    legend.style.display = 'block';
    const colorScale = getColorScale(choroplethData) || [];
    const metricLabel = getMetricLabel(activeLayer);
    legend.innerHTML = '';
    const title = document.createElement('div');
    title.textContent = metricLabel;
    title.style.marginBottom = '5px';
    title.style.fontWeight = 'bold';
    legend.appendChild(title);
    const gradient = document.createElement('div');
    gradient.style.display = 'flex';
    gradient.style.marginBottom = '5px';
    gradient.style.height = '10px';
    gradient.style.width = '100%';
    gradient.style.background = `linear-gradient(to right, ${colorScale.map(([_, color]) => color).join(', ')})`;
    legend.appendChild(gradient);
    const labels = document.createElement('div');
    labels.style.display = 'flex';
    labels.style.justifyContent = 'space-between';
    labels.style.fontSize = '0.8em';
    const minLabel = document.createElement('span');
    minLabel.textContent = (activeLayer === 'mortality') ? colorScale[0][0].toFixed(3) + '%' : colorScale[0][0].toFixed(1);
    const maxLabel = document.createElement('span');
    maxLabel.textContent = (activeLayer === 'mortality') ? `${colorScale[colorScale.length - 1][0].toFixed(3)}%+` : `${colorScale[colorScale.length - 1][0].toFixed(1)}+`;
    labels.appendChild(minLabel);
    labels.appendChild(maxLabel);
    legend.appendChild(labels);
  };

  // Helper to get the property name for the current metric and sub-metric
  const getMetricProperty = () => {
    if (activeLayer === 'mortality') {
      return 'value';
    }
    if (activeLayer === 'population') {
      return 'population';
    }
    if (metric === 'average') {
      if (subMetric === 'total') return 'avg_total';
      if (subMetric === 'fire') return 'avg_fire';
      if (subMetric === 'nonfire') return 'avg_nonfire';
    } else if (metric === 'max') {
      if (subMetric === 'total') return 'max_total';
      if (subMetric === 'fire') return 'max_fire';
      if (subMetric === 'nonfire') return 'max_nonfire';
    } else if (metric === 'pop_weighted') {
      if (subMetric === 'total') return 'pop_weighted_total';
      if (subMetric === 'fire') return 'pop_weighted_fire';
      if (subMetric === 'nonfire') return 'pop_weighted_nonfire';
    }
    return 'avg_total';
  };

  // Function to fetch bar chart data for a specific county
  const fetchBarChartData = async (fips, currentTimeScale = timeScale, currentYear = year, currentMonth = month, currentSeason = season) => {
    try {
      let params = new URLSearchParams();
      let endpoint = `http://localhost:8000/api/pm25/bar_chart/${fips}`;

      // console.log('Fetching bar chart data with time scale:', currentTimeScale);

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
      // console.log('Received bar chart data:', data);

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
            displayType: 'daily',
            ...(currentTimeScale === 'seasonal' ? { season: currentSeason } : {})
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

  // Function to fetch mortality bar chart data for a specific county
  const fetchMortalityBarChartData = async (fips) => {
    try {
      const response = await fetch(`http://localhost:8000/api/excess_mortality?fips=${fips}`);
      if (!response.ok) return [];
      const data = await response.json();
      // Only keep years 2013-2023, sort by year
      return data
        .filter(d => d.year >= 2013 && d.year <= 2023)
        .sort((a, b) => a.year - b.year)
        .map(d => ({
          year: d.year,
          label: d.year.toString(),
          fire: d.fire_excess || 0,
          nonFire: d.nonfire_excess || 0,
          total: (d.fire_excess || 0) + (d.nonfire_excess || 0),
          displayType: 'yearly',
        }));
    } catch {
      return [];
    }
  };

  // Initialize map when component mounts
  useEffect(() => {
    console.log('Map initialization useEffect triggered:', { activeLayer, pm25SubLayer, PM25_LAYERS: PM25_LAYERS.includes(activeLayer), HEALTH_LAYERS: HEALTH_LAYERS.includes(activeLayer) });

    if (!mapboxToken) {
      setError('Mapbox token is missing');
      return;
    }
    if (!mapContainer.current) return;
    if (!PM25_LAYERS.includes(activeLayer) && !HEALTH_LAYERS.includes(activeLayer)) return;
    // For PM2.5 layers, require sub-layer selection
    if (PM25_LAYERS.includes(activeLayer) && !pm25SubLayer) return;

    console.log('Initializing map for layer:', activeLayer);
    mapboxgl.accessToken = mapboxToken;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v10',
      bounds: [-150.0, 24.0, -60.0, 50.0],
      padding: { top: 20, bottom: 20, left: 20, right: 20 }
    });
    map.current.dragRotate.disable();
    map.current.touchZoomRotate.disableRotation();
    // Create popup instance ONCE
    popup.current = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: 'none'
    });
    // Cleanup
    return () => {
      if (map.current) {
        if (map.current.loaded()) {
          map.current.off('mousemove');
          map.current.off('mouseleave', 'pm25-layer');
          map.current.off('mouseleave');
        }
        if (popup.current) popup.current.remove();
        map.current.remove();
        map.current = null;
      }
    };
  }, [mapboxToken, activeLayer, pm25SubLayer]);

  // Helper function to get color scale based on metric
  const getColorScale = (data = null) => {
    const metric = getMetricProperty();

    // Handle health layers
    if (activeLayer === 'mortality') {
      return MORTALITY_COLORS;
    }
    if (activeLayer === 'population') {
      return POPULATION_COLORS;
    }

    // If we have data, calculate dynamic scale for PM2.5 layers
    if (data) {
      return calculateDynamicColorScale(data, metric);
    }

    // Fallback to static scales for PM2.5 layers
    if (metric.includes('pop_weighted')) {
      return POP_WEIGHTED_COLORS;
    } else if (metric.includes('fire') && !metric.includes('nonfire')) {
      return PM25_COLORS_FIRE;
    }
    return PM25_COLORS_TOTAL;
  };

  // Helper function to get metric label
  const getMetricLabel = (metric = getMetricProperty()) => {
    if (activeLayer === 'mortality') {
      return 'Excess Mortality (% of Population)';
    }
    if (activeLayer === 'population') {
      return 'Population';
    }

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
    console.log('Map layer rendering useEffect triggered:', { activeLayer, choroplethData: !!choroplethData, mapLoaded: map.current?.isStyleLoaded() });

    if (!PM25_LAYERS.includes(activeLayer) && !HEALTH_LAYERS.includes(activeLayer)) return;
    if (!map.current || !choroplethData) return;
    if (!map.current.isStyleLoaded()) return;

    console.log('Rendering map layer for:', activeLayer);
    const mapInstance = map.current;
    const metricForColor = getMetricProperty();
    console.log('Using metric for color:', metricForColor);

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

  }, [choroplethData, activeLayer, timeScale, year, month, season]);

  // Update mousemove handler to send county info to sidebar
  useEffect(() => {
    if (!PM25_LAYERS.includes(activeLayer) && !HEALTH_LAYERS.includes(activeLayer)) return;
    if (!map.current) return;
    const mapInstance = map.current;

    // Named handler to avoid stale closures and duplicate handlers
    const handleMouseMove = async (e) => {
      const features = mapInstance.queryRenderedFeatures(e.point, { layers: ['pm25-layer'] });
      if (features.length > 0) {
        const feature = features[0];
        const props = feature.properties;
        const countyId = props.GEOID || props.FIPS || props.fips;
        if (currentCountyRef.current !== countyId) {
          if (popup.current) popup.current.remove();
          currentCountyRef.current = countyId;
          mapInstance.getCanvas().style.cursor = 'pointer';
          let barChartData = [];
          try {
            if (PM25_LAYERS.includes(activeLayer)) {
              barChartData = await fetchBarChartData(
                countyId,
                timeScale,
                year,
                month,
                season
              );
            } else if (activeLayer === 'mortality') {
              barChartData = await fetchMortalityBarChartData(countyId);
            }
          } catch (err) { }
          const countyName = props.county_name || props.NAME || 'Unknown County';
          const metricProperty = getMetricProperty();
          const value = props[metricProperty] || 0;
          const countyData = {
            name: countyName,
            value,
            fips: countyId,
            population: props.population,
            avg_total: props.avg_total,
            avg_fire: props.avg_fire,
            avg_nonfire: props.avg_nonfire,
            max_total: props.max_total,
            max_fire: props.max_fire,
            max_nonfire: props.max_nonfire,
            pop_weighted_total: props.pop_weighted_total,
            pop_weighted_fire: props.pop_weighted_fire,
            pop_weighted_nonfire: props.pop_weighted_nonfire,
            pm25: props.pm25,
            y0: props.y0,
            delta_mortality: props.delta_mortality,
            total_excess: props.total_excess,
            fire_excess: props.fire_excess,
            nonfire_excess: props.nonfire_excess,
            barChartData,
            timeScale,
            year,
            month,
            season,
            subMetric,
            activeLayer
          };
          if (onCountyHover) onCountyHover(countyData);
          if (popup.current) {
            let formattedValue;
            if (activeLayer === 'population') {
              formattedValue = value !== undefined ? value.toLocaleString() : 'N/A';
            } else if (activeLayer === 'mortality') {
              formattedValue = (typeof value === 'number') ? value.toFixed(3) + '%' : 'N/A';
            } else if (typeof value === 'number' && Math.abs(value) >= 1000) {
              formattedValue = value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            } else if (typeof value === 'number') {
              formattedValue = value.toFixed(2);
            } else {
              formattedValue = 'N/A';
            }
            popup.current.setLngLat(e.lngLat)
              .setHTML(`<div style='font-weight:bold;font-size:1.1em;'>${countyName}</div><div>Value: ${formattedValue}</div>`)
              .addTo(mapInstance);
          }
        } else {
          if (popup.current && popup.current.isOpen()) {
            popup.current.setLngLat(e.lngLat);
          }
        }
      } else {
        if (popup.current) popup.current.remove();
        mapInstance.getCanvas().style.cursor = '';
        if (currentCountyRef.current !== null) {
          currentCountyRef.current = null;
          if (onCountyHover) onCountyHover(null);
        }
      }
    };

    // Click handler
    const handleClick = async (e) => {
      const features = mapInstance.queryRenderedFeatures(e.point, { layers: ['pm25-layer'] });
      if (features.length > 0) {
        const feature = features[0];
        const props = feature.properties;
        const countyId = props.GEOID || props.FIPS || props.fips;
        const countyName = props.county_name || props.NAME || 'Unknown County';
        const metricProperty = getMetricProperty();
        const value = props[metricProperty] || 0;

        // Fetch bar chart data for selected county
        let barChartData = [];
        try {
          if (PM25_LAYERS.includes(activeLayer)) {
            barChartData = await fetchBarChartData(
              countyId,
              timeScale,
              year,
              month,
              season
            );
          } else if (activeLayer === 'mortality') {
            barChartData = await fetchMortalityBarChartData(countyId);
          }
        } catch (err) {
          console.error('Error fetching bar chart data for selection:', err);
        }

        const countyData = {
          name: countyName,
          value,
          fips: countyId,
          population: props.population,
          avg_total: props.avg_total,
          avg_fire: props.avg_fire,
          avg_nonfire: props.avg_nonfire,
          max_total: props.max_total,
          max_fire: props.max_fire,
          max_nonfire: props.max_nonfire,
          pop_weighted_total: props.pop_weighted_total,
          pop_weighted_fire: props.pop_weighted_fire,
          pop_weighted_nonfire: props.pop_weighted_nonfire,
          pm25: props.pm25,
          y0: props.y0,
          delta_mortality: props.delta_mortality,
          total_excess: props.total_excess,
          fire_excess: props.fire_excess,
          nonfire_excess: props.nonfire_excess,
          barChartData,
          timeScale,
          year,
          month,
          season,
          subMetric,
          activeLayer
        };
        if (onCountySelect) onCountySelect(countyData);
      } else {
        if (onCountySelect) onCountySelect(null);
      }
    };

    // Remove old handler, then add new one
    mapInstance.off('mousemove', handleMouseMove);
    mapInstance.on('mousemove', handleMouseMove);
    mapInstance.off('mouseleave', 'pm25-layer');
    mapInstance.on('mouseleave', 'pm25-layer', () => {
      mapInstance.getCanvas().style.cursor = '';
      if (popup.current) popup.current.remove();
      currentCountyRef.current = null;
      if (onCountyHover) onCountyHover(null);
    });
    mapInstance.off('mouseleave');
    mapInstance.on('mouseleave', () => {
      if (popup.current) popup.current.remove();
      currentCountyRef.current = null;
      if (onCountyHover) onCountyHover(null);
    });
    mapInstance.off('click', handleClick);
    mapInstance.on('click', handleClick);
    // Cleanup
    return () => {
      mapInstance.off('mousemove', handleMouseMove);
      mapInstance.off('mouseleave', 'pm25-layer');
      mapInstance.off('mouseleave');
      mapInstance.off('click', handleClick);
      if (popup.current) popup.current.remove();
    };
  }, [choroplethData, activeLayer, timeScale, year, month, season]);

  // Highlight selected county outline
  useEffect(() => {
    if (!map.current || !choroplethData) return;
    const mapInstance = map.current;
    // Remove previous outline layer/source if exists
    if (mapInstance.getLayer('selected-county-outline')) {
      mapInstance.removeLayer('selected-county-outline');
    }
    if (mapInstance.getSource('selected-county-outline')) {
      mapInstance.removeSource('selected-county-outline');
    }
    if (selectedCounty && selectedCounty.fips) {
      // Find the feature for the selected county
      const feature = choroplethData.features.find(f => f.properties.fips === selectedCounty.fips);
      if (feature) {
        mapInstance.addSource('selected-county-outline', {
          type: 'geojson',
          data: feature
        });
        mapInstance.addLayer({
          id: 'selected-county-outline',
          type: 'line',
          source: 'selected-county-outline',
          paint: {
            'line-color': '#1976d2',
            'line-width': 3,
            'line-opacity': 1
          }
        });
      }
    }
  }, [selectedCounty, choroplethData]);

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

  if (PM25_LAYERS.includes(activeLayer) && !pm25SubLayer) {
    return (
      <div style={{ padding: 24, color: '#333', background: '#fff', height: '100%' }}>
        <h3>Please select a PM2.5 sub-layer.</h3>
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
        key={activeLayer + '-' + pm25SubLayer}
        ref={mapContainer}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          minHeight: 300,
          zIndex: 0
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