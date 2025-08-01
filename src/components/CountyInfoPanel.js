import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CountyBarChart from './CountyBarChart';
import CountyMortalityBarChart from './CountyMortalityBarChart';
import CountyDecompositionChart from './CountyDecompositionChart';

const categoryMeanings = [
    'Below threshold',
    'Exceeding due to fire smoke on Tier 1 days',
    'Exceeding due to fire smoke on Tier 1 & 2 days',
    'Exceeding due to fire smoke on Tier 1,2,3 days',
    'Exceeding after excluding fire smoke on Tier 1,2,3 days'
];

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
        decompositionData,
        decompositionPM25Type,
        timeScale,
        year,
        month,
        season,
        subMetric,
        activeLayer,
        total_excess,
        fire_excess,
        nonfire_excess,
        yll_total,
        yll_fire,
        yll_nonfire,
        threshold_8,
        threshold_9
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
                    Excess Mortality (% of Population): {value !== undefined ? value.toFixed(3) + '%' : 'N/A'}
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.93em', mb: 0.1 }}>
                    Excess from Fire-attributed PM2.5: {fire_excess !== undefined ? fire_excess.toFixed(1) : 'N/A'} deaths/year
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.93em', mb: 0.1 }}>
                    Excess from Non-fire PM2.5: {nonfire_excess !== undefined ? nonfire_excess.toFixed(1) : 'N/A'} deaths/year
                </Typography>
            </>;
        } else if (activeLayer === 'yll') {
            return <>
                <Typography variant="body2" sx={{ fontSize: '0.93em', mb: 0.1 }}>
                    YLL (Years of Life Lost): {yll_total !== undefined ? yll_total.toFixed(1) : 'N/A'}
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.93em', mb: 0.1 }}>
                    YLL from Fire-attributed PM2.5: {yll_fire !== undefined ? yll_fire.toFixed(1) : 'N/A'}
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.93em', mb: 0.1 }}>
                    YLL from Non-fire PM2.5: {yll_nonfire !== undefined ? yll_nonfire.toFixed(1) : 'N/A'}
                </Typography>
            </>;
        } else if (activeLayer === 'population') {
            return <Typography variant="body2" sx={{ fontSize: '0.93em', mb: 0.1 }}>Population: {population !== undefined ? population.toLocaleString() : 'N/A'}</Typography>;
        }
        return null;
    };

    const isExceedanceLayer = activeLayer === 'exceedance_8' || activeLayer === 'exceedance_9';
    let exceedanceValue = null;
    if (isExceedanceLayer) {
        exceedanceValue = activeLayer === 'exceedance_8' ? selectedCounty.threshold_8 : selectedCounty.threshold_9;
    }

    return (
        <Box sx={{ fontSize: '0.97em', p: 0.5, pb: 2, position: 'relative' }}>
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
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ fontSize: '1.08em', mb: 0.25 }}>{name || 'County'}</Typography>
            {/* Exceedance category for current layer, if active */}
            {isExceedanceLayer && exceedanceValue !== null && exceedanceValue !== undefined && (
                <Box sx={{ mb: 1, p: 1, background: '#fffde7', borderRadius: 2, border: '1.5px solid #ffe082', display: 'flex', alignItems: 'center' }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#d32f2f', mr: 1, minWidth: 32, textAlign: 'center' }}>{exceedanceValue}</Typography>
                    <Typography variant="body1" sx={{ color: '#333', fontWeight: 500 }}>{categoryMeanings[exceedanceValue]}</Typography>
                </Box>
            )}
            <Box sx={{ mb: 0.5 }}>
                {activeLayer !== 'population' && population > 0 && (
                    <Typography variant="body2" sx={{ mt: 0.5, fontSize: '0.93em' }}><strong>Population:</strong> {population.toLocaleString()}</Typography>
                )}
                {renderRelevantMetrics()}
            </Box>
            {/* Exceedance Tiers Section */}
            {selectedCounty && (selectedCounty.threshold_8 !== undefined || selectedCounty.threshold_9 !== undefined) && (
                <Box sx={{ mt: 1, mb: 1, p: 1, background: '#e3f2fd', borderRadius: 2, border: '1px solid #90caf9' }}>
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ fontSize: '1em', mb: 0.5 }}>
                        Exceedance Category
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.93em', mb: 0.2 }}>
                        <strong>Threshold 8 µg/m³:</strong> {selectedCounty.threshold_8 !== undefined && selectedCounty.threshold_8 !== null ? selectedCounty.threshold_8 : 'N/A'}
                        {selectedCounty.threshold_8 !== undefined && selectedCounty.threshold_8 !== null && (
                            <> — <span style={{ color: '#1976d2' }}>{categoryMeanings[selectedCounty.threshold_8]}</span></>
                        )}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.93em', mb: 0.2 }}>
                        <strong>Threshold 9 µg/m³:</strong> {selectedCounty.threshold_9 !== undefined && selectedCounty.threshold_9 !== null ? selectedCounty.threshold_9 : 'N/A'}
                        {selectedCounty.threshold_9 !== undefined && selectedCounty.threshold_9 !== null && (
                            <> — <span style={{ color: '#1976d2' }}>{categoryMeanings[selectedCounty.threshold_9]}</span></>
                        )}
                    </Typography>
                </Box>
            )}
            {isBarChartDataForCurrentTimeScale() && (
                <Box sx={{ mt: 1, pt: 0, pb: 1, px: 1, background: '#f7f8fa', borderRadius: 1, border: '1px solid #e0e4ea', minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ fontSize: '1em', mb: 0.5 }}>
                        {activeLayer === 'mortality' ? 'Excess Mortality Bar Chart' : activeLayer === 'yll' ? 'YLL Bar Chart' : 'PM2.5 Bar Chart'}
                    </Typography>
                    {activeLayer === 'mortality' ? (
                        <CountyMortalityBarChart data={barChartData} timeScale="yearly" />
                    ) : activeLayer === 'yll' ? (
                        <CountyMortalityBarChart data={barChartData} timeScale="yearly" yllMode />
                    ) : (
                        <CountyBarChart key={timeScale} data={barChartData} timeScale={timeScale} />
                    )}
                </Box>
            )}

            {/* Decomposition Analysis Chart */}
            {decompositionData && activeLayer === 'mortality' && (
                <Box sx={{ mt: 1, pt: 0, pb: 1, px: 1, background: '#f7f8fa', borderRadius: 1, border: '1px solid #e0e4ea', minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ fontSize: '1em', mb: 0.5 }}>
                        Decomposition Analysis (2006–2023) - {decompositionPM25Type === 'fire' ? 'Fire PM2.5' : 'Total PM2.5'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.8em', mb: 0.5 }}>
                        Factor contribution to change in excess mortality
                    </Typography>

                    <CountyDecompositionChart decompositionData={decompositionData} />
                </Box>
            )}
        </Box>
    );
};

export default CountyInfoPanel;