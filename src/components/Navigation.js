import React from 'react';
import { Box, Tabs, Tab, Typography } from '@mui/material';

function Navigation({ activeTab, onTabChange }) {
    const handleChange = (event, newValue) => {
        onTabChange(newValue);
    };

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 'normal', flexGrow: 1, fontFamily: 'Roboto, sans-serif', color: '#333', fontSize: '1.6rem', padding: '8px 0' }}>
                PM2.5 Wildfire Impact Map
            </Typography>
            <Tabs
                value={activeTab}
                onChange={handleChange}
                sx={{
                    '& .MuiTab-root': {
                        color: 'rgba(0, 0, 0, 0.7)',
                        fontWeight: 500,
                        fontSize: '0.9rem',
                        textTransform: 'none',
                        minWidth: 'auto',
                        padding: '6px 16px',
                        fontFamily: 'Roboto, sans-serif',
                        '&.Mui-selected': {
                            color: '#333',
                            fontWeight: 600,
                        },
                        '&:hover': {
                            color: '#333',
                            backgroundColor: 'rgba(255, 255, 255, 0.6)',
                            borderRadius: '4px',
                        }
                    },
                    '& .MuiTabs-indicator': {
                        backgroundColor: '#333',
                        height: '3px',
                    }
                }}
            >
                <Tab label="Map" value="map" />
                <Tab label="About" value="about" />
                <Tab label="Partners" value="partners" />
                <Tab label="Methodology" value="methodology" />
            </Tabs>
        </Box>
    );
}

export default Navigation; 