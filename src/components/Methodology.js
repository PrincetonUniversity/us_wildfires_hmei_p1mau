import React, { useState } from 'react';
import { Box, Typography, Paper, Container, Grid, Card, CardContent, Accordion, AccordionSummary, AccordionDetails, Button, FormControl, InputLabel, Select, MenuItem, TextField } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DownloadIcon from '@mui/icons-material/Download';

function Methodology() {
    const [expanded, setExpanded] = useState(false);
    // Data download state - UNCOMMENT WHEN READY TO IMPLEMENT
    // const [downloadType, setDownloadType] = useState('pm25');
    // const [timeScale, setTimeScale] = useState('yearly');
    // const [startYear, setStartYear] = useState(2020);
    // const [endYear, setEndYear] = useState(2023);
    // const [loading, setLoading] = useState(false);

    const handleExpand = () => {
        setExpanded(!expanded);
    };

    // Data download handler - UNCOMMENT WHEN READY TO IMPLEMENT
    // const handleDownload = async () => {
    //     setLoading(true);
    //     try {
    //         let endpoint = '';
    //         let filename = '';
    //         
    //         switch (downloadType) {
    //             case 'pm25':
    //                 endpoint = `/api/download/pm25?time_scale=${timeScale}&start_year=${startYear}&end_year=${endYear}`;
    //                 filename = `pm25_data_${time_scale}_${startYear}_${endYear}.csv`;
    //                 break;
    //             case 'mortality':
    //                 endpoint = `/api/download/mortality?start_year=${startYear}&end_year=${endYear}`;
    //                 filename = `mortality_data_${startYear}_${endYear}.csv`;
    //                 break;
    //             case 'yll':
    //                 endpoint = `/api/download/yll?start_year=${startYear}&end_year=${endYear}`;
    //                 filename = `yll_data_${startYear}_${endYear}.csv`;
    //                 break;
    //             default:
    //                 return;
    //         }
    //         
    //         const response = await fetch(endpoint);
    //         if (response.ok) {
    //             const blob = await response.blob();
    //             const url = window.URL.createObjectURL(blob);
    //             const a = document.createElement('a');
    //             a.href = url;
    //             a.download = filename;
    //             document.body.appendChild(a);
    //             a.click();
    //             window.URL.revokeObjectURL(url);
    //             document.body.removeChild(a);
    //         }
    //     } catch (error) {
    //         console.error('Download failed:', error);
    //     } finally {
    //         setLoading(false);
    //     }
    // };

    // Data download handler - UNCOMMENT WHEN READY TO IMPLEMENT
    // const handleDownload = async () => {
    //     setLoading(true);
    //     try {
    //         let endpoint = '';
    //         let filename = '';
    //         
    //         switch (downloadType) {
    //             case 'pm25':
    //                 endpoint = `/api/download/pm25?time_scale=${timeScale}&start_year=${startYear}&end_year=${endYear}`;
    //                 filename = `pm25_data_${timeScale}_${startYear}_${endYear}.csv`;
    //                 break;
    //             case 'mortality':
    //                 endpoint = `/api/download/mortality?start_year=${startYear}&end_year=${endYear}`;
    //                 filename = `mortality_data_${startYear}_${endYear}.csv`;
    //                 break;
    //             case 'yll':
    //                 endpoint = `/api/download/yll?start_year=${startYear}&end_year=${endYear}`;
    //                 filename = `yll_data_${startYear}_${endYear}.csv`;
    //                 break;
    //             default:
    //                 return;
    //         }
    //         
    //         const response = await fetch(endpoint);
    //         if (response.ok) {
    //             const blob = await response.blob();
    //             const url = window.URL.createObjectURL(blob);
    //             const a = document.createElement('a');
    //             a.href = url;
    //             a.download = filename;
    //             document.body.appendChild(a);
    //             a.click();
    //             window.URL.revokeObjectURL(url);
    //             document.body.removeChild(a);
    //         }
    //     } catch (error) {
    //         console.error('Download failed:', error);
    //     } finally {
    //         setLoading(false);
    //     }
    // };

    return (
        <Container maxWidth="lg" sx={{ py: 4, px: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom className="page-title" sx={{ ml: 4 }}>
                Data & Methodology
            </Typography>

            {/* Executive Summary */}
            <Paper elevation={2} sx={{ p: 4, mb: 4, ml: 4, mr: 4, backgroundColor: '#f8f9fa' }}>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: '#333' }}>
                    Quick Overview
                </Typography>
                <Typography variant="body1" paragraph>
                    This platform combines multiple data sources to understand how wildfire smoke affects public health across the United States:
                </Typography>
                <Box component="ul" sx={{ pl: 2 }}>
                    <Typography component="li" variant="body1" sx={{ mb: 1 }}>
                        <strong>Data Sources:</strong> Air quality monitoring, satellite observations, and computer models
                    </Typography>
                    <Typography component="li" variant="body1" sx={{ mb: 1 }}>
                        <strong>Health Analysis:</strong> Estimates of deaths and years of life lost due to wildfire smoke
                    </Typography>
                    <Typography component="li" variant="body1">
                        <strong>Key Finding:</strong> Wildfire smoke significantly impacts public health, with effects varying by location and population
                    </Typography>
                </Box>
            </Paper>

            <Paper elevation={2} sx={{ p: 4, mb: 4, ml: 4, mr: 4 }}>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: '#333' }}>
                    Data Sources
                </Typography>
                <Typography variant="body1" paragraph>
                    Our analysis combines multiple data sources to create a comprehensive understanding of wildfire
                    smoke impacts on public health:
                </Typography>

                <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                        <Card elevation={1} sx={{ height: '100%' }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#333' }}>
                                    Surface Smoke Observations (2000–2023)
                                </Typography>
                                <Typography variant="body2" paragraph>
                                    From NOAA's Integrated Surface Database (ISD) using ~1,400 U.S. weather stations.
                                    Smoke days identified using automated weather code (AW = 5) and visibility/observer indicators.
                                    Data filtered by observation duration and outliers to ensure quality.
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <Card elevation={1} sx={{ height: '100%' }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#333' }}>
                                    Satellite Smoke Observations (2006–2023)
                                </Typography>
                                <Typography variant="body2" paragraph>
                                    From NOAA's Hazard Mapping System (HMS) using GOES and polar satellites.
                                    Manual classification into light, medium, and heavy smoke.
                                    Cloud interference and vertical smoke distribution are limitations.
                                    Incomplete/malformed data removed.
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <Card elevation={1} sx={{ height: '100%' }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#333' }}>
                                    PM2.5 (2006–2023)
                                </Typography>
                                <Typography variant="body2" paragraph>
                                    From EPA's Air Quality System (AQS) network.
                                    Includes daily PM2.5 data from long-term monitoring stations.
                                    Non-representative days and certain method codes excluded per EPA guidance.
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <Card elevation={1} sx={{ height: '100%' }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#333' }}>
                                    Model Simulations (GFDL AM4VR, 2021–2023)
                                </Typography>
                                <Typography variant="body2" paragraph>
                                    High-resolution simulations using satellite-based fire data.
                                    Provides additional validation and gap-filling for observational data.
                                    Limited to recent years due to computational constraints.
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <Card elevation={1} sx={{ height: '100%' }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#333' }}>
                                    Baseline Mortality Rate (2000–2019)
                                </Typography>
                                <Typography variant="body2" paragraph>
                                    From CDC WONDER and GBD US Health Disparities Collaborators.
                                    County-level mortality rates by age group and cause of death.
                                    Used as baseline for calculating excess mortality attributable to PM₂.₅.
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <Card elevation={1} sx={{ height: '100%' }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#333' }}>
                                    Life Expectancy Data
                                </Typography>
                                <Typography variant="body2" paragraph>
                                    From CDC county-level estimates.
                                    Used for calculating Years of Life Lost metrics.
                                    Provides demographic context for health impact assessments.
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <Card elevation={1} sx={{ height: '100%' }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#333' }}>
                                    Population Data (2006–2023)
                                </Typography>
                                <Typography variant="body2" paragraph>
                                    From US Census API (5-year ACS for post-2009, 1-year ACS for 2006-2009).
                                    County-level population by age group for demographic analysis.
                                    Used for population-weighted calculations and age-specific health impacts.
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <Card elevation={1} sx={{ height: '100%' }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#333' }}>
                                    PM Attribution Bins
                                </Typography>
                                <Typography variant="body2" paragraph>
                                    From research by Ma et al. (2024) and Qiu et al. (2024).
                                    Concentration-response functions for different PM₂.₅ exposure levels.
                                    Used for calculating health impacts and mortality burdens.
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            </Paper>

            <Paper elevation={2} sx={{ p: 4, mb: 4, ml: 4, mr: 4 }}>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: '#333' }}>
                    Methodology
                </Typography>
                <Typography variant="body1" paragraph>
                    Our analysis combines multiple methodological approaches to estimate the health impacts of wildfire smoke:
                </Typography>

                <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                        <Card elevation={1} sx={{ height: '100%' }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#333' }}>
                                    PM₂.₅ Methods
                                </Typography>
                                <Typography variant="body2" paragraph>
                                    We combine three methods to estimate PM₂.₅: surface observations, satellite data, and model simulations.
                                    Smoke days are identified and compared to seasonal non-smoke day baselines.
                                    Data quality controls exclude outliers and unreliable measurements.
                                </Typography>
                                <Typography variant="body2" paragraph>
                                    See supporting paper for detailed information.
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <Card elevation={1} sx={{ height: '100%' }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#333' }}>
                                    Health Impact Calculations
                                </Typography>
                                <Typography variant="body2" paragraph>
                                    We calculate excess mortality and Years of Life Lost using concentration-response functions
                                    and risk ratios from established research. Methods include GEMM and binned Poisson models.
                                    See supporting papers for detailed information.
                                </Typography>

                                {/* Technical Details */}
                                <Accordion sx={{ mt: 2 }}>
                                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                        <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                                            Technical Details
                                        </Typography>
                                    </AccordionSummary>
                                    <AccordionDetails>
                                        <Typography variant="body2" paragraph>
                                            Based on methodology from Burnett et al. (2018), Ma et al. (2024), and Qiu et al. (2024).
                                        </Typography>
                                        <Box sx={{
                                            backgroundColor: '#f5f5f5',
                                            p: 2,
                                            borderRadius: 1,
                                            fontFamily: 'monospace',
                                            fontSize: '0.8rem',
                                            mt: 2
                                        }}>
                                            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, fontSize: '0.9rem' }}>
                                                Excess Mortality Formula:
                                            </Typography>
                                            <Typography variant="body2" sx={{ mb: 0.5 }}>
                                                Excess Mortality = Baseline Mortality × (HR - 1) × Population
                                            </Typography>
                                            <Typography variant="body2" sx={{ mb: 0.5 }}>
                                                Where HR = Hazard Ratio from concentration-response function
                                            </Typography>
                                            <Typography variant="body2" sx={{ mb: 1, mt: 2, fontWeight: 600, fontSize: '0.9rem' }}>
                                                Years of Life Lost Formula:
                                            </Typography>
                                            <Typography variant="body2" sx={{ mb: 0.5 }}>
                                                Years of Life Lost = Excess Mortality × Life Expectancy at Death
                                            </Typography>
                                        </Box>
                                    </AccordionDetails>
                                </Accordion>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <Card elevation={1} sx={{ height: '100%' }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#333' }}>
                                    Decomposition Analysis
                                </Typography>
                                <Typography variant="body2" paragraph>
                                    We break down changes in mortality over time into different contributing factors: population growth, aging demographics,
                                    improvements in baseline health, and changes in air pollution exposure. This helps identify which factors are driving
                                    health trends. See supporting papers for detailed information.
                                </Typography>

                                {/* Technical Details */}
                                <Accordion sx={{ mt: 2 }}>
                                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                        <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                                            Technical Details
                                        </Typography>
                                    </AccordionSummary>
                                    <AccordionDetails>
                                        <Typography variant="body2" paragraph>
                                            Based on methodology from "Socio-demographic factors shaping the future global health burden from air pollution" (Yang et al., 2022).
                                        </Typography>
                                        <Box sx={{
                                            backgroundColor: '#f5f5f5',
                                            p: 2,
                                            borderRadius: 1,
                                            fontFamily: 'monospace',
                                            fontSize: '0.8rem',
                                            mt: 2
                                        }}>
                                            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, fontSize: '0.9rem' }}>
                                                Decomposition Components:
                                            </Typography>
                                            <Typography variant="body2" sx={{ mb: 0.5 }}>
                                                A (Pop. Growth) = Σ_age ((pop_2006/Σ_pop_2006) × Σ_pop_2023 × y_2006 × AF_2006)
                                            </Typography>
                                            <Typography variant="body2" sx={{ mb: 0.5 }}>
                                                B (Pop. Aging) = Σ_age ((pop_2023/Σ_pop_2023) × y_2006 × AF_2006 × (pop_age_2023/pop_age_2006))
                                            </Typography>
                                            <Typography variant="body2" sx={{ mb: 0.5 }}>
                                                C (Baseline Change) = Σ_age ((pop_2023/Σ_pop_2023) × y_2023 × AF_2006 × (y_2023/y_2006))
                                            </Typography>
                                            <Typography variant="body2" sx={{ mb: 0.5 }}>
                                                D (Exposure Change) = Σ_age ((pop_2023/Σ_pop_2023) × y_2023 × AF_2023 × (AF_2023/AF_2006))
                                            </Typography>
                                        </Box>
                                    </AccordionDetails>
                                </Accordion>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <Card elevation={1} sx={{ height: '100%' }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#333' }}>
                                    Statistical Models
                                </Typography>
                                <Typography variant="body2" paragraph>
                                    We use multiple statistical approaches including GEMM hazard ratio functions and binned Poisson models.
                                    These models account for non-linear exposure-response relationships and provide uncertainty estimates.
                                    See supporting papers for detailed information.
                                </Typography>

                                {/* Technical Details */}
                                <Accordion sx={{ mt: 2 }}>
                                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                        <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                                            Technical Details
                                        </Typography>
                                    </AccordionSummary>
                                    <AccordionDetails>
                                        <Typography variant="body2" paragraph>
                                            Based on methodology from Burnett et al. (2018) and Ma et al. (2024).
                                        </Typography>
                                        <Box sx={{
                                            backgroundColor: '#f5f5f5',
                                            p: 2,
                                            borderRadius: 1,
                                            fontFamily: 'monospace',
                                            fontSize: '0.8rem',
                                            mt: 2
                                        }}>
                                            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, fontSize: '0.9rem' }}>
                                                GEMM Hazard Ratio Function:
                                            </Typography>
                                            <Typography variant="body2" sx={{ mb: 0.5 }}>
                                                HR(z) = exp(θ × log(1 + z/α) × ω(z))
                                            </Typography>
                                            <Typography variant="body2" sx={{ mb: 1, mt: 2, fontWeight: 600, fontSize: '0.9rem' }}>
                                                Binned Poisson Model:
                                            </Typography>
                                            <Typography variant="body2" sx={{ mb: 0.5 }}>
                                                D_csy = exp(Σᵢ βᵢ smokeBINⁱ_csy + γW_csy + η_sy + θ_c + ε_csy)
                                            </Typography>
                                        </Box>
                                    </AccordionDetails>
                                </Accordion>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            </Paper>

            {/* Literature Section */}
            <Paper elevation={2} sx={{ p: 4, ml: 4, mr: 4 }}>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: '#333' }}>
                    Literature
                </Typography>
                <Card elevation={1} sx={{ mb: 4, backgroundColor: '#f8f9fa' }}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#333' }}>
                            This interface is part of an ongoing research paper
                        </Typography>
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#333', fontSize: '1rem' }}>
                            Tentative title:
                        </Typography>
                        <Typography variant="body1" paragraph sx={{ fontStyle: 'italic', mb: 2 }}>
                            Improving estimates of wildfire smoke contributions to surface PM₂.₅ pollution to support US air quality management
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Yuanyu Xie, Denise L. Mauzerall, Meiyun Lin, Janiya Angoy, Bonne Ford, Jennifer McGinnis, Jeffrey R. Pierce, Larry W. Horowitz, Tianjia Liu, Mi Zhou, Beichen Lv, Hassan Khan
                        </Typography>
                    </CardContent>
                </Card>
                <Typography variant="body1" paragraph>
                    This research builds upon the following key publications:
                </Typography>

                <Grid container spacing={2}>
                    <Grid item xs={12}>
                        <Card elevation={1} sx={{ mb: 2 }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#333', fontSize: '1rem' }}>
                                    <a href="https://www.pnas.org/doi/10.1073/pnas.1803222115" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                                        Burnett, R., et al. (2018). Global estimates of mortality associated with long-term exposure to outdoor fine particulate matter.
                                    </a>
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Proceedings of the National Academy of Sciences, 115(38), 9592-9597.
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12}>
                        <Card elevation={1} sx={{ mb: 2 }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#333', fontSize: '1rem' }}>
                                    <a href="https://www.pnas.org/doi/abs/10.1073/pnas.2403960121" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                                        Ma, Y., et al. (2024). Long-term exposure to wildland fire smoke PM2.5 and mortality in the contiguous United States.
                                    </a>
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Proceedings of the National Academy of Sciences, 121(40), e2403960121.
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12}>
                        <Card elevation={1} sx={{ mb: 2 }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#333', fontSize: '1rem' }}>
                                    <a href="https://eartharxiv.org/repository/view/6844/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                                        Qiu, M., et al. (2024). Wildfire smoke exposure and mortality burden in the US under future climate change.
                                    </a>
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    EarthArXiv preprint. https://eartharxiv.org/repository/view/6844/
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12}>
                        <Card elevation={1} sx={{ mb: 2 }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#333', fontSize: '1rem' }}>
                                    <a href="https://doi.org/10.1038/s41893-022-00976-8" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                                        Yang, H., et al. (2022). Socio-demographic factors shaping the future global health burden from air pollution.
                                    </a>
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Nature Sustainability, 5(12), 1047-1056. https://doi.org/10.1038/s41893-022-00976-8
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12}>
                        <Card elevation={1}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#333', fontSize: '1rem' }}>
                                    <a href="https://pubmed.ncbi.nlm.nih.gov/37544309/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                                        GBD US Health Disparities Collaborators (2023). Cause-specific mortality by county, race, and ethnicity in the USA, 2000–19: a systematic analysis of health disparities.
                                    </a>
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    The Lancet, 402(10407), 1065-1082. doi: 10.1016/S0140-6736(23)01088-7
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            </Paper>

            {/* Data Download Section - ADDED NEW SECTION */}
            <Paper elevation={2} sx={{ p: 4, mb: 4, ml: 4, mr: 4, mt: 4 }}>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: '#333' }}>
                    Data Downloads
                </Typography>
                <Typography variant="body1" paragraph>
                    Download processed data for research and analysis. All data includes key columns from our summary tables,
                    filtered by your selected time period and data type.
                </Typography>

                {/* Coming Soon Notice - REMOVE WHEN READY TO IMPLEMENT */}
                <Box sx={{
                    backgroundColor: '#fff3cd',
                    border: '1px solid #ffeaa7',
                    borderRadius: 2,
                    p: 3,
                    mb: 3,
                    textAlign: 'center'
                }}>
                    <Typography variant="h6" sx={{ color: '#856404', mb: 1 }}>
                        🚧 Coming Soon
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#856404' }}>
                        Data download functionality is currently under development.
                    </Typography>
                </Box>

                {/* Data Download Interface - UNCOMMENT WHEN READY TO IMPLEMENT */}
                {/* 
                <Grid container spacing={3} sx={{ mb: 3 }}>
                    <Grid item xs={12} md={3}>
                        <FormControl fullWidth>
                            <InputLabel>Data Type</InputLabel>
                            <Select
                                value={downloadType}
                                label="Data Type"
                                onChange={(e) => setDownloadType(e.target.value)}
                            >
                                <MenuItem value="pm25">PM₂.₅ Data</MenuItem>
                                <MenuItem value="mortality">Excess Mortality</MenuItem>
                                <MenuItem value="yll">Years of Life Lost</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <FormControl fullWidth>
                            <InputLabel>Time Scale</InputLabel>
                            <Select
                                value={timeScale}
                                label="Time Scale"
                                onChange={(e) => setTimeScale(e.target.value)}
                                disabled={downloadType !== 'pm25'}
                            >
                                <MenuItem value="yearly">Yearly</MenuItem>
                                <MenuItem value="monthly">Monthly</MenuItem>
                                <MenuItem value="seasonal">Seasonal</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={2}>
                        <TextField
                            fullWidth
                            label="Start Year"
                            type="number"
                            value={startYear}
                            onChange={(e) => setStartYear(parseInt(e.target.value))}
                            inputProps={{ min: 2006, max: 2023 }}
                        />
                    </Grid>
                    <Grid item xs={12} md={2}>
                        <TextField
                            fullWidth
                            label="End Year"
                            type="number"
                            value={endYear}
                            onChange={(e) => setEndYear(parseInt(e.target.value))}
                            inputProps={{ min: 2006, max: 2023 }}
                        />
                    </Grid>
                    <Grid item xs={12} md={2}>
                        <Button
                            fullWidth
                            variant="contained"
                            startIcon={<DownloadIcon />}
                            onClick={handleDownload}
                            disabled={loading || startYear > endYear}
                            sx={{ height: '56px' }}
                        >
                            {loading ? 'Downloading...' : 'Download'}
                        </Button>
                    </Grid>
                </Grid>
                */}
            </Paper>

        </Container>
    );
}

export default Methodology; 