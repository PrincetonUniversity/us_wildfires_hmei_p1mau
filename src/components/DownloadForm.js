import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Box,
    Typography,
    Alert,
    Autocomplete,
    Chip,
    CircularProgress,
    Divider,
    Paper
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';

const DownloadForm = ({ open, onClose }) => {
    const [formData, setFormData] = useState({
        name: '',
        institution: '',
        email: '',
        usage_description: '',
        data_type: 'pm25', // Fixed to PM2.5 for now
        time_scale: 'yearly',
        start_year: 2021,
        end_year: 2023,
        counties: '',
        states: '',
        age_groups: ''
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    // Limited to 2021-2023 for now
    const years = [2021, 2022, 2023];

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setError('');
    };

    const handleSubmit = async () => {
        // Validation
        if (!formData.name || !formData.institution || !formData.email || !formData.usage_description) {
            setError('Please fill in all required fields');
            return;
        }

        if (formData.start_year > formData.end_year) {
            setError('Start year must be less than or equal to end year');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // API base URL
            const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

            // Prepare data, converting empty strings to null for optional fields
            const requestData = {
                ...formData,
                counties: formData.counties || null,
                states: formData.states || null,
                age_groups: formData.age_groups || null
            };

            // Submit download request
            console.log('Submitting download request:', requestData);
            const response = await fetch(`${apiBaseUrl}/api/download/request`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Download request failed:', errorData);

                // Handle FastAPI validation errors
                let errorMessage = 'Failed to submit download request';
                if (errorData.detail) {
                    if (Array.isArray(errorData.detail)) {
                        // Pydantic validation errors
                        errorMessage = errorData.detail.map(err =>
                            `${err.loc.join('.')}: ${err.msg}`
                        ).join(', ');
                    } else if (typeof errorData.detail === 'string') {
                        errorMessage = errorData.detail;
                    }
                }
                throw new Error(errorMessage);
            }

            await response.json();
            setSuccess(true);

            // Trigger actual download
            const downloadParams = new URLSearchParams({
                time_scale: formData.time_scale,
                start_year: formData.start_year,
                end_year: formData.end_year
            });

            if (formData.counties) downloadParams.append('counties', formData.counties);
            if (formData.states) downloadParams.append('states', formData.states);
            if (formData.age_groups && ['mortality', 'yll'].includes(formData.data_type)) {
                downloadParams.append('age_groups', formData.age_groups);
            }

            const downloadUrl = `${apiBaseUrl}/api/download/${formData.data_type}?${downloadParams.toString()}`;

            // Create a temporary link and click it to trigger download
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `${formData.data_type}_data_${formData.start_year}_${formData.end_year}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Reset form after 2 seconds
            setTimeout(() => {
                setSuccess(false);
                onClose();
                setFormData({
                    name: '',
                    institution: '',
                    email: '',
                    usage_description: '',
                    data_type: 'pm25',
                    time_scale: 'yearly',
                    start_year: 2021,
                    end_year: 2023,
                    counties: '',
                    states: '',
                    age_groups: ''
                });
            }, 2000);

        } catch (err) {
            setError(err.message || 'An error occurred while processing your request');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">Download PM2.5 & Health Data</Typography>
                    <IconButton onClick={onClose} size="small">
                        <CloseIcon />
                    </IconButton>
                </Box>
            </DialogTitle>

            <DialogContent>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                {success && <Alert severity="success" sx={{ mb: 2 }}>Download started successfully!</Alert>}

                {/* User Information Section */}
                <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1.5 }}>
                    User Information
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
                    <TextField
                        required
                        label="Name"
                        value={formData.name}
                        onChange={(e) => handleChange('name', e.target.value)}
                        fullWidth
                        size="small"
                    />
                    <TextField
                        required
                        label="Institution"
                        value={formData.institution}
                        onChange={(e) => handleChange('institution', e.target.value)}
                        fullWidth
                        size="small"
                    />
                    <TextField
                        required
                        type="email"
                        label="Email"
                        value={formData.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                        fullWidth
                        size="small"
                    />
                    <TextField
                        required
                        label="Brief description of data usage"
                        value={formData.usage_description}
                        onChange={(e) => handleChange('usage_description', e.target.value)}
                        fullWidth
                        multiline
                        rows={3}
                        size="small"
                    />
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Data Selection Section */}
                <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1.5 }}>
                    Data Selection
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
                    {/* Data Type - Fixed to PM2.5, shown as info only */}
                    <Box sx={{
                        p: 1.5,
                        bgcolor: '#e3f2fd',
                        borderRadius: 1,
                        border: '1px solid #90caf9'
                    }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#1565c0' }}>
                            Data Type: PM2.5 (2021-2023)
                        </Typography>
                    </Box>

                    <FormControl fullWidth size="small">
                        <InputLabel>Temporal Frequency</InputLabel>
                        <Select
                            value={formData.time_scale}
                            label="Temporal Frequency"
                            onChange={(e) => handleChange('time_scale', e.target.value)}
                        >
                            <MenuItem value="daily">Daily</MenuItem>
                            <MenuItem value="monthly">Monthly</MenuItem>
                            <MenuItem value="seasonal">Seasonal</MenuItem>
                            <MenuItem value="yearly">Yearly</MenuItem>
                        </Select>
                    </FormControl>

                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Start Year</InputLabel>
                            <Select
                                value={formData.start_year}
                                label="Start Year"
                                onChange={(e) => handleChange('start_year', e.target.value)}
                            >
                                {years.map(year => (
                                    <MenuItem key={year} value={year}>{year}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl fullWidth size="small">
                            <InputLabel>End Year</InputLabel>
                            <Select
                                value={formData.end_year}
                                label="End Year"
                                onChange={(e) => handleChange('end_year', e.target.value)}
                            >
                                {years.map(year => (
                                    <MenuItem key={year} value={year}>{year}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>

                    <TextField
                        label="Counties (FIPS codes, comma-separated, or 'all')"
                        value={formData.counties}
                        onChange={(e) => handleChange('counties', e.target.value)}
                        fullWidth
                        size="small"
                        placeholder="e.g., 06037,36061 or 'all'"
                        helperText="Leave blank for all counties"
                    />

                    <TextField
                        label="States (names, comma-separated, or 'all')"
                        value={formData.states}
                        onChange={(e) => handleChange('states', e.target.value)}
                        fullWidth
                        size="small"
                        placeholder="e.g., California,New York or 'all'"
                        helperText="Leave blank for all states"
                    />
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Citation Information */}
                <Paper elevation={0} sx={{ bgcolor: '#f5f5f5', p: 2, borderRadius: 1 }}>
                    <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                        How to Cite
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1.5 }}>
                        If you use this data in your research, please cite the following:
                    </Typography>
                    <Box sx={{ pl: 1 }}>
                        <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                            Improving estimates of wildfire smoke contributions to surface PM₂.₅ pollution to support US air quality management
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.5, fontSize: '0.875rem', color: 'text.secondary' }}>
                            Yuanyu Xie, et al.
                        </Typography>
                    </Box>
                </Paper>
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onClose} disabled={loading}>
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={20} /> : <DownloadIcon />}
                    sx={{
                        bgcolor: '#1976d2',
                        '&:hover': { bgcolor: '#1565c0' }
                    }}
                >
                    {loading ? 'Processing...' : 'Download Data'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default DownloadForm;
