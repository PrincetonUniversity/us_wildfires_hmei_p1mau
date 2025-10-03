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
const HEALTH_LAYERS = ['mortality', 'yll', 'population'];

const LayerTimeControls = ({
    activeLayer,
    setActiveLayer,
    pm25SubLayer,
    setPm25SubLayer,
    timeControls,
    setTimeControls,
    showTimeControls,
    mortalitySubMetric,
    setMortalitySubMetric
}) => {
    // PM2.5 main options
    // { value: 'pop_weighted', label: 'Pop-weighted' },
    const pm25Options = [
        { value: 'average', label: 'Average' },
        { value: 'max', label: 'Max' },

    ];
    // PM2.5 sub-options
    const pm25SubOptions = [
        { value: 'total', label: 'Total' },
        { value: 'fire', label: 'Smoke' },
        { value: 'nonfire', label: 'Non-smoke' },
    ];
    // Health options
    const healthOptions = [
        { value: 'mortality', label: 'Mortality' },
        { value: 'yll', label: 'Years of Life Lost' },
    ];

    // Years for dropdown
    const years = Array.from({ length: 18 }, (_, i) => 2006 + i);
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const seasons = ['winter', 'spring', 'summer', 'fall'];

    // Health sub-options for mortality
    const mortalitySubOptions = [
        { value: 'total', label: 'Total' },
        { value: 'fire', label: 'Smoke' },
        { value: 'nonfire', label: 'Non-smoke' },
    ];

    if (showTimeControls === true) {
        // Only render the time controls section
        return (
            <Box sx={{ mt: 0.5, display: 'flex', flexDirection: 'column', gap: 0.7 }}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 0.2, fontSize: '0.98em' }}>
                    Time Controls
                </Typography>
                {['mortality', 'yll', 'population'].includes(activeLayer) ? (
                    // Only show year dropdown for mortality/Years of Life Lost/population
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
        );
    }
    if (showTimeControls === false) {
        // Only render the layer and sub-metric controls
        return (
            <>
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
                                        bgcolor: activeLayer === opt.value ? '#e9ae40' : 'white',
                                        color: activeLayer === opt.value ? 'white' : '#e9ae40',
                                        borderColor: '#e9ae40',
                                        '&:hover': {
                                            bgcolor: activeLayer === opt.value ? '#be8a29' : '#f4d8a8',
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
                                    {pm25SubOptions.map(opt => (
                                        <Button
                                            key={opt.value}
                                            size="small"
                                            sx={{
                                                ...pillStyle,
                                                bgcolor: pm25SubLayer === opt.value ? '#e9ae40' : 'white',
                                                color: pm25SubLayer === opt.value ? 'white' : '#e9ae40',
                                                borderColor: '#e9ae40',
                                                '&:hover': {
                                                    bgcolor: pm25SubLayer === opt.value ? '#be8a29' : '#f4d8a8',
                                                    color: 'white'
                                                }
                                            }}
                                            onClick={() => setPm25SubLayer(opt.value)}
                                        >
                                            {opt.label}
                                        </Button>
                                    ))}
                                </ButtonGroup>
                            </Box>
                        )}
                    </Box>
                </Box>
                {/* Health Section */}
                {false && ( // TODO: Remove this once health metrics are added
                    <Box sx={{ mb: 1.1 }}>
                        <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 0.4, fontSize: '0.98em' }}>
                            Health Metrics
                        </Typography>
                        <ButtonGroup variant="outlined" size="small" sx={{ flexWrap: 'wrap' }}>
                            {healthOptions.map(opt => (
                                <Button
                                    key={opt.value}
                                    size="small"
                                    className={activeLayer === opt.value ? 'health-metric-active' : 'health-metric-inactive'}
                                    sx={{
                                        ...pillStyle,
                                        bgcolor: activeLayer === opt.value ? '#dc004e' : 'white',
                                        color: activeLayer === opt.value ? 'white' : '#dc004e',
                                        borderColor: '#dc004e',
                                        '&:hover': {
                                            bgcolor: activeLayer === opt.value ? '#a7003a' : '#ff6b9d',
                                            color: 'white'
                                        }
                                    }}
                                    onClick={() => setActiveLayer(opt.value)}
                                >
                                    {opt.label}
                                </Button>
                            ))}
                        </ButtonGroup>
                        {/* Mortality sub-metric selector: show directly below the mortality pill, no heading */}
                        {activeLayer === 'mortality' && (
                            <Box sx={{ mt: 0.2, display: 'block' }}>
                                <ButtonGroup variant="outlined" size="small" sx={{ display: 'inline-flex' }}>
                                    {mortalitySubOptions.map(opt => (
                                        <Button
                                            key={opt.value}
                                            size="small"
                                            sx={{
                                                ...pillStyle,
                                                bgcolor: mortalitySubMetric === opt.value ? '#d32f2f' : 'white',
                                                color: mortalitySubMetric === opt.value ? 'white' : '#d32f2f',
                                                borderColor: '#d32f2f',
                                                px: 1,
                                                py: 0.2,
                                                m: 0.1,
                                                '&:hover': {
                                                    bgcolor: mortalitySubMetric === opt.value ? '#b71c1c' : '#ffcdd2',
                                                    color: 'white'
                                                }
                                            }}
                                            onClick={() => setMortalitySubMetric(opt.value)}
                                        >
                                            {opt.label}
                                        </Button>
                                    ))}
                                </ButtonGroup>
                            </Box>
                        )}
                    </Box>
                )}
                {/* Regulatory Support / Exceedance Category Section */}
                <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 0.4, fontSize: '0.98em' }}>
                    Exceedance Categories (2021-2023 Average)
                </Typography>
                <ButtonGroup variant="outlined" size="small" sx={{ flexWrap: 'wrap' }}>
                    <Button
                        size="small"
                        className={activeLayer === 'exceedance_8' ? 'exceedance-active' : 'exceedance-inactive'}
                        sx={{
                            ...pillStyle,
                            bgcolor: activeLayer === 'exceedance_8' ? '#4dd0e1' : 'white',
                            color: activeLayer === 'exceedance_8' ? 'white' : '#00838f',
                            borderColor: '#00838f',
                            '&:hover': {
                                bgcolor: activeLayer === 'exceedance_8' ? '#00838f' : '#b2ebf2',
                                color: 'white'
                            }
                        }}
                        onClick={() => setActiveLayer('exceedance_8')}
                    >
                        Exceedance (8 µg/m³)
                    </Button>
                    <Button
                        size="small"
                        className={activeLayer === 'exceedance_9' ? 'exceedance-active' : 'exceedance-inactive'}
                        sx={{
                            ...pillStyle,
                            bgcolor: activeLayer === 'exceedance_9' ? '#4dd0e1' : 'white',
                            color: activeLayer === 'exceedance_9' ? 'white' : '#00838f',
                            borderColor: '#00838f',
                            '&:hover': {
                                bgcolor: activeLayer === 'exceedance_9' ? '#00838f' : '#b2ebf2',
                                color: 'white'
                            }
                        }}
                        onClick={() => setActiveLayer('exceedance_9')}
                    >
                        Exceedance (9 µg/m³)
                    </Button>
                </ButtonGroup>
            </>
        );
    }
    // Default: render both
    return (
        <>
            {/* Layer and sub-metric controls only */}
            <LayerTimeControls
                activeLayer={activeLayer}
                setActiveLayer={setActiveLayer}
                pm25SubLayer={pm25SubLayer}
                setPm25SubLayer={setPm25SubLayer}
                timeControls={timeControls}
                setTimeControls={setTimeControls}
                showTimeControls={false}
                mortalitySubMetric={mortalitySubMetric}
                setMortalitySubMetric={setMortalitySubMetric}
            />
            {/* Time controls only */}
            <LayerTimeControls
                activeLayer={activeLayer}
                setActiveLayer={setActiveLayer}
                pm25SubLayer={pm25SubLayer}
                setPm25SubLayer={setPm25SubLayer}
                timeControls={timeControls}
                setTimeControls={setTimeControls}
                showTimeControls={true}
            />
        </>
    );
};

export default LayerTimeControls;