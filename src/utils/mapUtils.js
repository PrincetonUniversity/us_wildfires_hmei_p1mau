import { Popup } from 'maplibre-gl';

export const createPopup = (feature, lngLat, map) => {
  const { properties } = feature;

  // Format the popup content
  const popupContent = document.createElement('div');
  popupContent.style.padding = '8px';
  popupContent.style.fontFamily = 'Arial, sans-serif';
  popupContent.style.fontSize = '14px';
  popupContent.style.minWidth = '200px';

  // Add county name
  const title = document.createElement('h4');
  title.textContent = properties.NAME || 'Unknown County';
  title.style.margin = '0 0 8px 0';
  title.style.fontSize = '16px';
  title.style.fontWeight = 'bold';
  popupContent.appendChild(title);

  // Add PM2.5 data
  const addDataRow = (label, value, unit = '') => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.marginBottom = '4px';

    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    labelEl.style.fontWeight = '500';

    const valueEl = document.createElement('span');
    valueEl.textContent = `${value}${unit}`;

    row.appendChild(labelEl);
    row.appendChild(valueEl);
    popupContent.appendChild(row);
  };

  // Add data rows
  if (properties.total_pm25 !== undefined) {
    addDataRow('Total PM2.5:', properties.total_pm25.toFixed(2), ' µg/m³');
  }

  if (properties.fire_pm25 !== undefined) {
    addDataRow('Fire PM2.5:', properties.fire_pm25.toFixed(2), ' µg/m³');
  }

  if (properties.fire_pm25_pct !== undefined) {
    addDataRow('Fire Contribution:', properties.fire_pm25_pct.toFixed(1), '%');
  }

  if (properties.exceedance) {
    const warning = document.createElement('div');
    warning.textContent = '⚠️ Exceeds EPA standard (9 µg/m³)';
    warning.style.color = '#d32f2f';
    warning.style.marginTop = '8px';
    warning.style.fontWeight = '500';
    warning.style.fontSize = '13px';
    popupContent.appendChild(warning);
  }

  // Create and return the popup
  const popup = new Popup({
    closeButton: false,
    closeOnClick: false,
    maxWidth: '300px'
  })
    .setLngLat(lngLat)
    .setDOMContent(popupContent)
    .addTo(map);

  return popup;
};

// Helper to format numbers with commas
// export const formatNumber = (num) => {
//   return num ? num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '0';
// };

// Add more utility functions as needed
