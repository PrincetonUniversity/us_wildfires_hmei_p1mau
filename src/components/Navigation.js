import React from 'react';
import { Box, Tabs, Tab, Typography } from '@mui/material';

function Navigation({ activeTab, onTabChange }) {
    const handleChange = (event, newValue) => {
        onTabChange(newValue);
    };

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <img
                src="/PU_lockup.png"
                alt="App Logo"
                className="app-logo"
            />
            <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', flex: 1, textAlign: 'center' }}>
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
                            backgroundColor: 'transparent',
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
                <Tab label="Data & Methodology" value="methodology" />
            </Tabs>
        </Box>
    );
}

export default Navigation; 