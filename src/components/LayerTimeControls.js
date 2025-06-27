import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';

const pillStyle = {
    borderRadius: 4,
    textTransform: 'none',
    fontWeight: 'bold',
    px: 1.2,
    py: 0.5,
    m: 0.3,
    minWidth: 0,
    fontSize: '0.81rem',
};

const PM25_LAYERS = ['average', 'max', 'pop_weighted'];
const HEALTH_LAYERS = ['mortality', 'population'];

const LayerTimeControls = ({
    activeLayer,
    setActiveLayer,
    pm25SubLayer,
    setPm25SubLayer,
    timeControls,
    setTimeControls
}) => {
    // PM2.5 main options
    const pm25Options = [
        { value: 'average', label: 'Average' },
        { value: 'max', label: 'Max' },
        { value: 'pop_weighted', label: 'Pop-weighted' },
    ];
    // PM2.5 sub-options
    const pm25SubOptions = [
        { value: 'total', label: 'Total' },
        { value: 'fire', label: 'Fire' },
        { value: 'nonfire', label: 'Non-fire' },
    ];
    // Health options
    const healthOptions = [
        { value: 'mortality', label: 'Mortality' },
        { value: 'population', label: 'Population' },
    ];

    // Years for dropdown
    const years = Array.from({ length: 11 }, (_, i) => 2013 + i);
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const seasons = ['winter', 'spring', 'summer', 'fall'];

    // Health sub-options for mortality
    const mortalitySubOptions = [
        { value: 'total', label: 'Total' },
        { value: 'fire', label: 'Fire' },
        { value: 'nonfire', label: 'Non-fire' },
    ];

    return (
        <Box sx={{ p: 0.5 }}>
            {/* PM2.5 Section */}
            <Box sx={{ mb: 1.1 }}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 0.4, fontSize: '0.98em' }}>
                    PM2.5 Metrics
                </Typography>
                {/* PM2.5 Main Layer Buttons with Sub-layers */}
                <Box sx={{ mb: 0.4 }}>
                    <ButtonGroup variant="outlined" size="small" sx={{ flexWrap: 'wrap' }}>
                        {pm25Options.map(opt => (
                            <Button
                                key={opt.value}
                                size="small"
                                sx={{
                                    ...pillStyle,
                                    bgcolor: activeLayer === opt.value ? 'primary.main' : 'white',
                                    color: activeLayer === opt.value ? 'white' : 'primary.main',
                                    borderColor: 'primary.main',
                                    '&:hover': {
                                        bgcolor: activeLayer === opt.value ? 'primary.dark' : 'primary.light',
                                        color: 'white'
                                    }
                                }}
                                onClick={() => {
                                    setActiveLayer(opt.value);
                                    setPm25SubLayer(pm25SubLayer || 'total');
                                }}
                            >
                                {opt.label}
                            </Button>
                        ))}
                    </ButtonGroup>
                    {/* Sub-layer buttons (only show if a PM2.5 layer is active) */}
                    {PM25_LAYERS.includes(activeLayer) && (
                        <Box sx={{ ml: 0, mt: 0.3 }}>
                            <ButtonGroup variant="outlined" size="small" sx={{ flexWrap: 'wrap' }}>
                                {pm25SubOptions.map(subOpt => (
                                    <Button
                                        key={subOpt.value}
                                        size="small"
                                        sx={{
                                            ...pillStyle,
                                            bgcolor: pm25SubLayer === subOpt.value ? 'primary.main' : 'white',
                                            color: pm25SubLayer === subOpt.value ? 'white' : 'primary.main',
                                            borderColor: 'primary.main',
                                            '&:hover': {
                                                bgcolor: pm25SubLayer === subOpt.value ? 'primary.dark' : 'primary.light',
                                                color: 'white'
                                            }
                                        }}
                                        onClick={() => setPm25SubLayer(subOpt.value)}
                                    >
                                        {subOpt.label}
                                    </Button>
                                ))}
                            </ButtonGroup>
                        </Box>
                    )}
                </Box>
            </Box>
            {/* Health/Demographic Section */}
            <Box sx={{ mb: 1.1 }}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 0.4, fontSize: '0.98em' }}>
                    Health / Demographic
                </Typography>
                <ButtonGroup variant="outlined" sx={{ flexWrap: 'wrap' }}>
                    {healthOptions.map(opt => (
                        <Button
                            key={opt.value}
                            sx={{
                                ...pillStyle,
                                bgcolor: activeLayer === opt.value ? 'secondary.main' : 'white',
                                color: activeLayer === opt.value ? 'white' : 'secondary.main',
                                borderColor: 'secondary.main',
                                '&:hover': {
                                    bgcolor: activeLayer === opt.value ? 'secondary.dark' : 'secondary.light',
                                    color: 'white'
                                }
                            }}
                            onClick={() => setActiveLayer(opt.value)}
                        >
                            {opt.label}
                        </Button>
                    ))}
                </ButtonGroup>
                {/* Mortality sub-metric selector */}
                {activeLayer === 'mortality' && (
                    <Box sx={{ ml: 0, mt: 0.7 }}>
                        <ButtonGroup variant="outlined" size="small" sx={{ flexWrap: 'wrap' }}>
                            {mortalitySubOptions.map(subOpt => (
                                <Button
                                    key={subOpt.value}
                                    size="small"
                                    sx={{
                                        ...pillStyle,
                                        bgcolor: (timeControls.subMetric || 'total') === subOpt.value ? 'secondary.main' : 'white',
                                        color: (timeControls.subMetric || 'total') === subOpt.value ? 'white' : 'secondary.main',
                                        borderColor: 'secondary.main',
                                        '&:hover': {
                                            bgcolor: (timeControls.subMetric || 'total') === subOpt.value ? 'secondary.dark' : 'secondary.light',
                                            color: 'white'
                                        }
                                    }}
                                    onClick={() => setTimeControls({ ...timeControls, subMetric: subOpt.value })}
                                >
                                    {subOpt.label}
                                </Button>
                            ))}
                        </ButtonGroup>
                    </Box>
                )}
            </Box>
            {/* Time Controls Section */}
            <Box sx={{ mt: 0.5, display: 'flex', flexDirection: 'column', gap: 0.7 }}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 0.2, fontSize: '0.98em' }}>
                    Time Controls
                </Typography>
                {['mortality', 'population'].includes(activeLayer) ? (
                    // Only show year dropdown for mortality/population
                    <FormControl size="small" sx={{ mb: 0.5 }}>
                        <InputLabel id="year-label">Year</InputLabel>
                        <Select
                            labelId="year-label"
                            value={timeControls.year}
                            label="Year"
                            onChange={e => setTimeControls({ ...timeControls, year: parseInt(e.target.value) })}
                        >
                            {years.map(y => (
                                <MenuItem key={y} value={y}>{y}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                ) : (
                    <>
                        <FormControl size="small" sx={{ mb: 0.5 }}>
                            <InputLabel id="time-scale-label">Time Scale</InputLabel>
                            <Select
                                labelId="time-scale-label"
                                value={timeControls.timeScale}
                                label="Time Scale"
                                onChange={e => {
                                    const newScale = e.target.value;
                                    if (newScale === 'monthly') {
                                        setTimeControls({ ...timeControls, timeScale: newScale, month: 1, season: 'winter' });
                                    } else if (newScale === 'seasonal') {
                                        setTimeControls({ ...timeControls, timeScale: newScale, season: 'winter', month: 1 });
                                    } else {
                                        setTimeControls({ ...timeControls, timeScale: newScale, month: 1, season: 'winter' });
                                    }
                                }}
                            >
                                <MenuItem value="yearly">Yearly</MenuItem>
                                <MenuItem value="monthly">Monthly</MenuItem>
                                <MenuItem value="seasonal">Seasonal</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ mb: 0.5 }}>
                            <InputLabel id="year-label">Year</InputLabel>
                            <Select
                                labelId="year-label"
                                value={timeControls.year}
                                label="Year"
                                onChange={e => setTimeControls({ ...timeControls, year: parseInt(e.target.value) })}
                            >
                                {years.map(y => (
                                    <MenuItem key={y} value={y}>{y}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        {timeControls.timeScale === 'monthly' && (
                            <FormControl size="small" sx={{ mb: 0.5 }}>
                                <InputLabel id="month-label">Month</InputLabel>
                                <Select
                                    labelId="month-label"
                                    value={timeControls.month}
                                    label="Month"
                                    onChange={e => setTimeControls({ ...timeControls, month: parseInt(e.target.value) })}
                                >
                                    {months.map((name, i) => (
                                        <MenuItem key={i + 1} value={i + 1}>{name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}
                        {timeControls.timeScale === 'seasonal' && (
                            <FormControl size="small" sx={{ mb: 0.5 }}>
                                <InputLabel id="season-label">Season</InputLabel>
                                <Select
                                    labelId="season-label"
                                    value={timeControls.season}
                                    label="Season"
                                    onChange={e => setTimeControls({ ...timeControls, season: e.target.value })}
                                >
                                    {seasons.map(season => (
                                        <MenuItem key={season} value={season}>{season.charAt(0).toUpperCase() + season.slice(1)}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}
                    </>
                )}
            </Box>
        </Box>
    );
};

export default LayerTimeControls;