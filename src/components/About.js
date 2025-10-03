import React from 'react';
import { Box, Typography, Paper, Container, Link } from '@mui/material';

function About({ onTabChange }) {
    const handlePartnersClick = () => {
        if (onTabChange) {
            onTabChange('partners');
        }
    };

    return (
        <Container maxWidth="lg" sx={{ py: 4, px: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom className="page-title" sx={{ ml: 4 }}>
                About
            </Typography>

            <Paper elevation={2} sx={{ p: 4, mb: 4, ml: 4, mr: 4 }}>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: '#333' }}>
                    Project Overview
                </Typography>
                <Typography variant="body1" paragraph>
                    The PM₂.₅ Wildfire Impact Map is an interactive platform designed to explore how fine particulate matter
                    (PM₂.₅) from wildfire smoke affects public health across the United States. By integrating high-resolution
                    air quality estimates with demographic and mortality data, the tool provides a clear picture of how
                    wildfire smoke contributes to health risks over time and across regions.
                </Typography>
                <Typography variant="body1" paragraph>
                    The platform enables detailed examination of both spatial and temporal patterns,
                    allowing users to move seamlessly between nationwide trends and localized county-level
                    insights. This makes it possible to identify areas with the highest smoke-related health burdens,
                    track changes over multiple years, and compare patterns between smoke and non-smoke sources of PM₂.₅.
                    Researchers, policymakers, and the public can use these capabilities to better understand geographic
                    disparities, highlight vulnerable populations, and inform targeted interventions.
                </Typography>
                <Typography variant="body1" paragraph>
                    By transforming large and complex datasets into clear, accessible visualizations, the PM₂.₅ Wildfire Impact
                    Map bridges the gap between environmental science and practical decision-making, helping to strengthen
                    public health preparedness in the face of increasing wildfire activity.
                </Typography>
                <Typography variant="body1" paragraph>
                    This project was developed by an undergraduate intern at Princeton University's High Meadows
                    Environmental Institute with the Center for Policy Research on Energy and the Environment.
                    See <Link component="button" onClick={handlePartnersClick} sx={{ alignContent: 'center', textDecoration: 'underline', cursor: 'pointer', color: 'inherit' }}>Partners</Link> for more information.
                </Typography>
            </Paper>

            <Paper elevation={2} sx={{ p: 4, mb: 4, ml: 4, mr: 4 }}>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: '#333' }}>
                    Key Features
                </Typography>
                <Typography variant="body1" component="div" sx={{ pl: 2 }}>
                    <ul>
                        <li><strong>Interactive Maps</strong> — County-level PM₂.₅ exposure and mortality metrics with dynamic color-coded choropleth visualization</li>
                        <li><strong>Multi-Layer Analysis</strong> — Switch between PM₂.₅ data and health metrics (mortality, Years of Life Lost, population)</li>
                        <li><strong>Source Attribution</strong> — Separate analysis of smoke vs. non-smoke PM₂.₅ contributions with distinct color coding</li>
                        <li><strong>Time-Scale Analysis</strong> — Daily, monthly, seasonal, and annual views with flexible time controls</li>
                        <li><strong>County Profiles</strong> — Detailed county information panels showing PM₂.₅ statistics, population data, and health metrics</li>
                        <li><strong>Interactive Charts</strong> — Bar charts showing temporal trends in PM₂.₅ levels and mortality rates by source</li>
                        <li><strong>Decomposition Analysis</strong> — Breakdowns of mortality changes into demographic (population growth, aging) and environmental (exposure change, baseline mortality) contributions</li>
                        <li><strong>Mortality Analysis</strong> — Age-group specific mortality data with both death counts and Years of Life Lost metrics</li>
                        <li><strong>Exceedance Tracking</strong> — Monitor counties where 2021-2023 average PM₂.₅ levels exceed EPA air quality standards (8 and 9 µg/m³) with smoke vs. non-smoke attribution</li>
                        <li><strong>Dynamic Legend</strong> — Context-aware color scales and thresholds that adapt to the selected data layer</li>
                        <li><strong>Hover & Click Interactions</strong> — Real-time county information on hover and detailed analysis on click</li>
                    </ul>
                </Typography>
            </Paper>

            <Paper elevation={2} sx={{ p: 4, ml: 4, mr: 4 }}>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: '#333' }}>
                    Mission
                </Typography>
                <Typography variant="body1" paragraph>
                    Our mission is to transform complex environmental health research into clear, interactive
                    insights. By visualizing the drivers and impacts of wildfire-related air pollution, we aim to:
                </Typography>
                <Typography variant="body1" component="div" sx={{ pl: 2 }}>
                    <ul>
                        <li>Support evidence-based decision-making for public health and environmental policy</li>
                        <li>Highlight geographic and demographic disparities in exposure and outcomes</li>
                        <li>Increase public awareness of the health risks posed by wildfire smoke</li>
                    </ul>
                </Typography>
            </Paper>
        </Container>
    );
}

export default About; 