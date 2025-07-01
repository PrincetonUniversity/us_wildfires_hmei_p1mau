import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import LayerTimeControls from './LayerTimeControls';
import CountyInfoPanel from './CountyInfoPanel';

const Sidebar = ({
    activeLayer,
    setActiveLayer,
    pm25SubLayer,
    setPm25SubLayer,
    timeControls,
    setTimeControls,
    selectedCounty,
    loading,
    onClearSelectedCounty
}) => {
    return (
        <Box
            sx={{
                width: 500,
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                background: 'linear-gradient(135deg, #f8fafc 0%, #e3e8ef 100%)',
                boxShadow: '0 4px 24px 0 rgba(30, 34, 90, 0.10)',
                borderTopLeftRadius: 18,
                borderBottomLeftRadius: 18,
                zIndex: 10,
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            {/* Layer and Time Controls (moved from Map.js) */}
            <Paper elevation={0} sx={{
                flex: '0 0 auto',
                borderBottom: '1.5px solid #e0e4ea',
                borderRadius: 0,
                boxShadow: 'none',
                p: 0.7,
                background: 'rgba(255,255,255,0.95)',
                position: 'sticky',
                top: 0,
                zIndex: 1,
                minHeight: 0,
                '& .MuiTypography-root': { fontSize: '0.93rem' },
                '& .MuiButton-root': { minHeight: 22, fontSize: '0.82rem', py: 0.1, px: 0.8 },
                mb: 0.2
            }}>
                <LayerTimeControls
                    activeLayer={activeLayer}
                    setActiveLayer={setActiveLayer}
                    pm25SubLayer={pm25SubLayer}
                    setPm25SubLayer={setPm25SubLayer}
                    timeControls={timeControls}
                    setTimeControls={setTimeControls}
                />
            </Paper>
            {/* Bottom: County Info */}
            <Box sx={{
                flex: '1 1 auto',
                minHeight: 0,
                overflowY: 'auto',
                p: 2,
                background: 'rgba(255,255,255,0.85)',
                borderBottomLeftRadius: 18,
                transition: 'background 0.3s',
                boxShadow: 'none',
                scrollbarWidth: 'thin',
                '&::-webkit-scrollbar': {
                    width: '8px',
                    background: 'rgba(0,0,0,0.03)'
                },
                '&::-webkit-scrollbar-thumb': {
                    background: '#cfd8dc',
                    borderRadius: 8
                }
            }}>
                <CountyInfoPanel selectedCounty={selectedCounty} onClearSelectedCounty={onClearSelectedCounty} />
            </Box>
        </Box>
    );
};

export default Sidebar; 