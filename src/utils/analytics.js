// Basic server-side pageview tracking (same-origin, no third-party scripts)
const ensureApiPath = (baseUrl) => {
  const normalized = baseUrl.replace(/\/+$/, '');
  return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
};

export const getApiBaseUrl = () => {
  const configuredBaseUrl = process.env.REACT_APP_API_BASE_URL;
  if (configuredBaseUrl) {
    return ensureApiPath(configuredBaseUrl);
  }

  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:8000/api';
  }

  const isHeatmapPath = window.location.pathname === '/heatmap'
    || window.location.pathname.startsWith('/heatmap/');
  return `${window.location.origin}${isHeatmapPath ? '/heatmap/api' : '/api'}`;
};

export function trackPageview(path) {
  const apiBaseUrl = getApiBaseUrl();
  fetch(`${apiBaseUrl}/track-view`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  }).catch(() => {}); // fire-and-forget; tracking must never surface an error to the user
}
