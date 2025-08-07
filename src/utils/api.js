// API utility functions
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

export const apiCall = async (endpoint, params = {}) => {
  const url = new URL(endpoint, window.location.origin + API_BASE_URL);

  // Add query parameters
  Object.keys(params).forEach(key => {
    if (params[key] !== null && params[key] !== undefined) {
      url.searchParams.append(key, params[key]);
    }
  });

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
};

export const getApiUrl = (endpoint) => {
  return `${API_BASE_URL}${endpoint}`;
};
