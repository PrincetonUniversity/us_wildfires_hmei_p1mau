import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CountyBarChart from './CountyBarChart';

const CountyInfoPanel = ({ selectedCounty, onClearSelectedCounty }) => {
    if (!selectedCounty) {
        return (
            <Box>
                <Typography variant="subtitle1" fontWeight="bold">County Information</Typography>
                <Typography variant="body2" color="text.secondary">Hover or click a county to see details here.</Typography>
            </Box>
        );
    }
    const {
        name,
        value,
        population,
        avg_total,
        avg_fire,
        avg_nonfire,
        max_total,
        max_fire,
        max_nonfire,
        pop_weighted_total,
        pop_weighted_fire,
        pop_weighted_nonfire,
        pm25,
        y0,
        delta_mortality,
        barChartData,
        timeScale,
        year,
        month,
        season,
        subMetric,
        activeLayer
    } = selectedCounty;

    const isBarChartDataForCurrentTimeScale = () => {
        if (!barChartData || barChartData.length === 0) return false;

        if (timeScale === 'yearly') {
            // For yearly time scale, we expect yearly data
            return barChartData[0].displayType === 'yearly';
        } else if (timeScale === 'monthly' || timeScale === 'seasonal') {
            // For monthly/seasonal time scales, we expect daily data
            return barChartData[0].displayType === 'daily';
        }

        return false;
    };

    // Helper: Render only relevant metrics for the selected main layer
    const renderRelevantMetrics = () => {
        if (activeLayer === 'average') {
            return <>
                <Typography variant="body2" sx={{ fontSize: '0.93em', mb: 0.1 }}>Average Total PM2.5: {avg_total !== undefined ? avg_total.toFixed(2) : 'N/A'} µg/m³</Typography>
                <Typography variant="body2" sx={{ fontSize: '0.93em', mb: 0.1 }}>Average Fire PM2.5: {avg_fire !== undefined ? avg_fire.toFixed(2) : 'N/A'} µg/m³</Typography>
                <Typography variant="body2" sx={{ fontSize: '0.93em', mb: 0.1 }}>Average Non-fire PM2.5: {avg_nonfire !== undefined ? avg_nonfire.toFixed(2) : 'N/A'} µg/m³</Typography>
            </>;
        } else if (activeLayer === 'max') {
            return <>
                <Typography variant="body2" sx={{ fontSize: '0.93em', mb: 0.1 }}>Max Total PM2.5: {max_total !== undefined ? max_total.toFixed(2) : 'N/A'} µg/m³</Typography>
                <Typography variant="body2" sx={{ fontSize: '0.93em', mb: 0.1 }}>Max Fire PM2.5: {max_fire !== undefined ? max_fire.toFixed(2) : 'N/A'} µg/m³</Typography>
                <Typography variant="body2" sx={{ fontSize: '0.93em', mb: 0.1 }}>Max Non-fire PM2.5: {max_nonfire !== undefined ? max_nonfire.toFixed(2) : 'N/A'} µg/m³</Typography>
            </>;
        } else if (activeLayer === 'pop_weighted') {
            return <>
                <Typography variant="body2" sx={{ fontSize: '0.93em', mb: 0.1 }}>Pop-weighted Total: {pop_weighted_total !== undefined ? pop_weighted_total.toLocaleString() : 'N/A'} person-µg/m³</Typography>
                <Typography variant="body2" sx={{ fontSize: '0.93em', mb: 0.1 }}>Pop-weighted Fire: {pop_weighted_fire !== undefined ? pop_weighted_fire.toLocaleString() : 'N/A'} person-µg/m³</Typography>
                <Typography variant="body2" sx={{ fontSize: '0.93em', mb: 0.1 }}>Pop-weighted Non-fire: {pop_weighted_nonfire !== undefined ? pop_weighted_nonfire.toLocaleString() : 'N/A'} person-µg/m³</Typography>
            </>;
        } else if (activeLayer === 'mortality') {
            return <>
                <Typography variant="body2" sx={{ fontSize: '0.93em', mb: 0.1 }}>
                    Excess Mortality: {value !== undefined ? value.toFixed(1) : 'N/A'} deaths/year
                </Typography>
                {selectedCounty.pm25 !== undefined && (
                    <Typography variant="body2" sx={{ fontSize: '0.93em', mb: 0.1 }}>
                        PM2.5 Level: {selectedCounty.pm25.toFixed(2)} µg/m³
                    </Typography>
                )}
                {selectedCounty.y0 !== undefined && (
                    <Typography variant="body2" sx={{ fontSize: '0.93em', mb: 0.1 }}>
                        Baseline Mortality Rate: {selectedCounty.y0.toFixed(4)}
                    </Typography>
                )}
            </>;
        } else if (activeLayer === 'population') {
            return <Typography variant="body2" sx={{ fontSize: '0.93em', mb: 0.1 }}>Population: {population !== undefined ? population.toLocaleString() : 'N/A'}</Typography>;
        }
        return null;
    };

    return (
        <Box sx={{ fontSize: '0.97em', p: 0.5, position: 'relative' }}>
            {/* X button for clearing selection */}
            {onClearSelectedCounty && (
                <button
                    onClick={onClearSelectedCounty}
                    aria-label="Clear selected county"
                    style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        background: 'transparent',
                        border: 'none',
                        color: '#888',
                        fontSize: 20,
                        cursor: 'pointer',
                        zIndex: 2
                    }}
                >
                    ×
                </button>
            )}
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ fontSize: '1.08em', mb: 0.5 }}>{name || 'County'}</Typography>
            <Box sx={{ mb: 0.7 }}>
                {renderRelevantMetrics()}
                {activeLayer !== 'population' && population > 0 && (
                    <Typography variant="body2" sx={{ mt: 0.5, fontSize: '0.93em' }}><strong>Population:</strong> {population.toLocaleString()}</Typography>
                )}
            </Box>
            {isBarChartDataForCurrentTimeScale() && (
                <Box sx={{ mt: 1, pt: 0, pb: 1, px: 1, background: '#f7f8fa', borderRadius: 1, border: '1px solid #e0e4ea' }}>
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ fontSize: '1em', mb: 0.5 }}>
                        PM2.5 Bar Chart
                        <span style={{ fontWeight: 'normal', fontSize: '0.8em', color: '#888', marginLeft: 8 }}>
                            [{barChartData[0]?.displayType}] {barChartData.length} pts
                        </span>
                    </Typography>
                    <CountyBarChart key={timeScale} data={barChartData} timeScale={timeScale} />
                    {/* AQI Legend: only for monthly/seasonal (daily) charts, with no gap */}
                    {timeScale !== 'yearly' && (
                        <Box sx={{ mt: 0, pt: 1, fontSize: '0.97em', width: '100%' }}>
                            <div style={{ fontWeight: 'bold', margin: 0, padding: 0 }}>AQI Legend:</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, margin: 0, padding: 0 }}>
                                <span style={{ background: '#00e400', color: '#000', padding: '2px 6px', borderRadius: 3, marginRight: 3 }}>Good</span>
                                <span style={{ background: '#ffff00', color: '#000', padding: '2px 6px', borderRadius: 3, marginRight: 3 }}>Moderate</span>
                                <span style={{ background: '#ff7e00', color: '#fff', padding: '2px 6px', borderRadius: 3, marginRight: 3 }}>Unhealthy for SG</span>
                                <span style={{ background: '#ff0000', color: '#fff', padding: '2px 6px', borderRadius: 3, marginRight: 3 }}>Unhealthy</span>
                                <span style={{ background: '#8f3f97', color: '#fff', padding: '2px 6px', borderRadius: 3, marginRight: 3 }}>Very Unhealthy</span>
                                <span style={{ background: '#7e0023', color: '#fff', padding: '2px 6px', borderRadius: 3 }}>Hazardous</span>
                            </div>
                        </Box>
                    )}
                </Box>
            )}
        </Box>
    );
};

export default CountyInfoPanel;