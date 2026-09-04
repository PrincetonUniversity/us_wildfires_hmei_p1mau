import React, { useState } from 'react';
import Papa from 'papaparse';
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Stack,
  Alert,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@mui/material';
import { getApiBaseUrl } from '../utils/analytics';

// Unlisted admin page (not in any nav) for visitor activity and download
// requests. Each API call is gated server-side by ADMIN_API_KEY; this page is
// only a friendly wrapper, not the access-control mechanism.
const KEY_STORAGE_KEY = 'wildfire_admin_key';

function AdminData() {
  const [apiKey, setApiKey] = useState(() => sessionStorage.getItem(KEY_STORAGE_KEY) || '');
  const [keyInput, setKeyInput] = useState('');
  const [records, setRecords] = useState(null);
  const [downloadRequests, setDownloadRequests] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [downloadingRequests, setDownloadingRequests] = useState(false);

  const fetchPageviews = (activeKey) => {
    setLoading(true);
    setError('');
    fetch(`${getApiBaseUrl()}/pageviews?limit=500`, {
      headers: { 'X-Admin-Key': activeKey },
    })
      .then((res) => {
        if (res.status === 401) {
          sessionStorage.removeItem(KEY_STORAGE_KEY);
          setApiKey('');
          throw new Error('Invalid or missing admin key.');
        }
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
      })
      .then((data) => setRecords(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  React.useEffect(() => {
    if (apiKey) {
      fetchPageviews(apiKey);
      fetchDownloadRequests(apiKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  const handleSubmitKey = (e) => {
    e.preventDefault();
    if (!keyInput.trim()) return;
    sessionStorage.setItem(KEY_STORAGE_KEY, keyInput.trim());
    setApiKey(keyInput.trim());
  };

  const fetchDownloadRequests = (activeKey) => {
    setLoadingRequests(true);
    setRequestError('');
    fetch(`${getApiBaseUrl()}/download-requests/export`, {
      headers: { 'X-Admin-Key': activeKey },
    })
      .then(async (res) => {
        if (res.status === 401) {
          sessionStorage.removeItem(KEY_STORAGE_KEY);
          setApiKey('');
          throw new Error('Invalid or missing admin key.');
        }
        if (res.status === 404) return [];
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const csv = await res.text();
        return Papa.parse(csv, { header: true, skipEmptyLines: true }).data;
      })
      .then((data) => setDownloadRequests(data))
      .catch((err) => setRequestError(err.message))
      .finally(() => setLoadingRequests(false));
  };

  const formatRequestScope = (request) => {
    const scopes = [];
    if (request.counties && request.counties !== 'All') scopes.push(`Counties: ${request.counties}`);
    if (request.states && request.states !== 'All') scopes.push(`States: ${request.states}`);
    if (request.age_groups && request.age_groups !== 'All') scopes.push(`Age groups: ${request.age_groups}`);
    return scopes.join(' · ') || 'All';
  };

  const downloadRequestLog = async () => {
    setDownloadingRequests(true);
    setError('');
    try {
      const response = await fetch(`${getApiBaseUrl()}/download-requests/export`, {
        headers: { 'X-Admin-Key': apiKey },
      });
      if (response.status === 401) {
        sessionStorage.removeItem(KEY_STORAGE_KEY);
        setApiKey('');
        throw new Error('Invalid or missing admin key.');
      }
      if (!response.ok) throw new Error(`Request failed (${response.status})`);

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'download_requests.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloadingRequests(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4, px: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom className="page-title" sx={{ ml: 4 }}>
        Site Activity &amp; Requests
      </Typography>

      {!apiKey && (
        <Paper elevation={2} sx={{ p: 4, mb: 4, ml: 4, mr: 4 }}>
          <Typography variant="body1" gutterBottom>
            Enter the admin API key to view site activity and download-request records.
          </Typography>
          <Box component="form" onSubmit={handleSubmitKey}>
            <Stack direction="row" spacing={2}>
              <TextField
                type="password"
                label="Admin API key"
                size="small"
                fullWidth
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
              />
              <Button type="submit" variant="contained">View</Button>
            </Stack>
          </Box>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </Paper>
      )}

      {apiKey && (
        <Paper elevation={2} sx={{ p: 4, mb: 4, ml: 4, mr: 4 }}>
          {loading && <Typography variant="body2">Loading…</Typography>}
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {records && (
            <>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Showing {records.length} most recent pageview{records.length === 1 ? '' : 's'}.
              </Typography>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Timestamp</TableCell>
                      <TableCell>Page</TableCell>
                      <TableCell>Country</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {records.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{row.created_at}</TableCell>
                        <TableCell>{row.title || row.path}</TableCell>
                        <TableCell>{row.country || 'Unknown'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </>
          )}
          <Box sx={{ mt: 3, pt: 3, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="h6" gutterBottom>
              Data-download requests
            </Typography>
            {loadingRequests && <Typography variant="body2">Loading download requests…</Typography>}
            {requestError && <Alert severity="error" sx={{ mb: 2 }}>{requestError}</Alert>}
            {downloadRequests && (
              downloadRequests.length === 0 ? (
                <Typography variant="body2" sx={{ mb: 2 }}>
                  No download requests have been submitted yet.
                </Typography>
              ) : (
                <Box sx={{ overflowX: 'auto', mb: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Timestamp</TableCell>
                        <TableCell>Name / institution</TableCell>
                        <TableCell>Email</TableCell>
                        <TableCell>Requested data</TableCell>
                        <TableCell>Scope</TableCell>
                        <TableCell>Intended use</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {downloadRequests.map((request, index) => (
                        <TableRow key={`${request.timestamp}-${request.email}-${index}`}>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                            {request.timestamp}
                          </TableCell>
                          <TableCell>
                            <Box>{request.name}</Box>
                            <Typography variant="body2" color="text.secondary">
                              {request.institution}
                            </Typography>
                          </TableCell>
                          <TableCell>{request.email}</TableCell>
                          <TableCell>
                            {request.data_type} ({request.time_scale}, {request.start_year}–{request.end_year})
                          </TableCell>
                          <TableCell>{formatRequestScope(request)}</TableCell>
                          <TableCell>{request.usage_description}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )
            )}
            <Button
              variant="outlined"
              onClick={downloadRequestLog}
              disabled={downloadingRequests}
            >
              {downloadingRequests ? 'Preparing CSV…' : 'Download request log (CSV)'}
            </Button>
          </Box>
        </Paper>
      )}
    </Container>
  );
}

export default AdminData;
