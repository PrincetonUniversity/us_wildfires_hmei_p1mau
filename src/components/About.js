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
                    Frequently Asked Questions
                </Typography>

                <Typography variant="h6" sx={{ fontWeight: 600, mt: 3, mb: 1 }}>
                    What is PM₂.₅?
                </Typography>
                <Typography variant="body1" paragraph>
                    PM₂.₅ refers to fine inhalable particles that are 2.5 micrometers or smaller in diameter—about 1/30
                    the width of a human hair. These particles can come from sources such as vehicle exhaust, industrial
                    emissions, wildfires, and agricultural burning.
                </Typography>

                <Typography variant="h6" sx={{ fontWeight: 600, mt: 3, mb: 1 }}>
                    Why is PM₂.₅ dangerous?
                </Typography>
                <Typography variant="body1" paragraph>
                    Because of their tiny size, PM₂.₅ particles can penetrate deep into the lungs and even enter the
                    bloodstream, affecting the heart, brain, and other organs. Health risks include increased asthma
                    attacks, reduced lung function, cardiovascular disease, and premature death from chronic exposure.
                </Typography>

                <Typography variant="h6" sx={{ fontWeight: 600, mt: 3, mb: 1 }}>
                    How do PM₂.₅ concentrations affect health?
                </Typography>
                <Typography variant="body1" paragraph>
                    For context, the World Health Organization (WHO) guideline for safe long-term exposure is 5 μg/m³
                    annual average for PM₂.₅. The EPA's current annual standard is 9 μg/m³, recently updated from 12 μg/m³.
                    Here's how common levels compare:
                </Typography>
                <Typography variant="body1" component="div" sx={{ pl: 2 }}>
                    <ul>
                        <li><strong>~9–12 μg/m³ (PM₂.₅):</strong> Approaching or exceeding EPA standards; linked to increased
                        health risks, especially for children, the elderly, and people with asthma or heart disease.</li>
                        <li><strong>~20 μg/m³:</strong> Significantly above EPA standards. Even healthy adults may experience
                        respiratory symptoms during prolonged outdoor activity; sensitive groups are at much higher risk.</li>
                        <li><strong>~35 μg/m³ and above:</strong> Unhealthy air quality. Prolonged exposure can affect everyone.
                        Outdoor activity should be limited, and hospitals may see increases in respiratory and cardiovascular cases.</li>
                    </ul>
                </Typography>

                <Typography variant="h6" sx={{ fontWeight: 600, mt: 3, mb: 1 }}>
                    What are the EPA air quality standards for PM₂.₅?
                </Typography>
                <Typography variant="body1" paragraph>
                    The EPA sets National Ambient Air Quality Standards (NAAQS) to protect public health. As of 2024,
                    the annual PM₂.₅ standard is 9 μg/m³ (updated from 12 μg/m³). This platform tracks exceedance
                    categories for both the 8 μg/m³ and 9 μg/m³ thresholds, showing whether counties exceed these levels
                    due to smoke or non-smoke sources.
                </Typography>

                <Typography variant="h6" sx={{ fontWeight: 600, mt: 3, mb: 1 }}>
                    What is the Air Quality Index (AQI)?
                </Typography>
                <Typography variant="body1" paragraph>
                    The Air Quality Index (AQI) is a standardized indicator that translates pollutant concentrations
                    into easy-to-understand categories ranging from "Good" (0–50) to "Hazardous" (301+). The EPA uses
                    AQI to communicate daily air quality to the public. While this platform displays raw PM₂.₅ concentrations
                    in μg/m³, understanding AQI categories can provide context: for example, PM₂.₅ levels of 12.1–35.4 μg/m³
                    correspond to "Moderate" AQI (51–100), while 35.5–55.4 μg/m³ indicates "Unhealthy for Sensitive Groups"
                    (101–150).
                </Typography>

                <Typography variant="h6" sx={{ fontWeight: 600, mt: 3, mb: 1 }}>
                    Why do we separate smoke from non-smoke PM₂.₅?
                </Typography>
                <Typography variant="body1" paragraph>
                    Wildfire smoke is increasingly contributing to PM₂.₅ exposure, particularly in Western states. By
                    separating smoke-attributed PM₂.₅ from other sources (vehicles, industry, etc.), we can better
                    understand the specific health burden from wildfires and target mitigation strategies accordingly.
                </Typography>

                <Typography variant="h6" sx={{ fontWeight: 600, mt: 3, mb: 1 }}>
                    Why do we care about seasonal and temporal pollution patterns?
                </Typography>
                <Typography variant="body1" paragraph>
                    Air pollution varies significantly by season and year. Wildfire activity peaks in summer and fall,
                    while meteorological conditions in winter can trap pollution near the ground. Understanding these
                    patterns helps identify high-risk periods and informs seasonal public health warnings.
                </Typography>

                <Typography variant="h6" sx={{ fontWeight: 600, mt: 3, mb: 1 }}>
                    How is excess mortality calculated?
                </Typography>
                <Typography variant="body1" paragraph>
                    Excess mortality estimates the number of deaths attributable to PM₂.₅ exposure above natural background
                    levels. The calculation uses epidemiological concentration-response functions that relate PM₂.₅ levels
                    to mortality risk, combined with county-level population and baseline mortality data. By separating
                    smoke-attributed PM₂.₅ from other sources, we can estimate how many deaths are specifically linked to
                    wildfire smoke versus other pollution sources. The mortality values shown are expressed as both absolute
                    death counts and as a percentage of the total county population.
                </Typography>

                <Typography variant="h6" sx={{ fontWeight: 600, mt: 3, mb: 1 }}>
                    What is Years of Life Lost (YLL)?
                </Typography>
                <Typography variant="body1" paragraph>
                    Years of Life Lost (YLL) is a metric that accounts for premature mortality by considering the age at which
                    deaths occur. It provides a more comprehensive picture of health impact than simple death counts, as
                    deaths at younger ages contribute more to the total YLL burden. For example, a death at age 40 represents
                    far more years of life lost than a death at age 80. YLL is calculated by summing the difference between
                    actual age at death and life expectancy across all PM₂.₅-attributable deaths, weighted by age group.
                </Typography>

                <Typography variant="h6" sx={{ fontWeight: 600, mt: 3, mb: 1 }}>
                    What does the Decomposition Analysis show?
                </Typography>
                <Typography variant="body1" paragraph>
                    The Decomposition Analysis breaks down changes in excess mortality over the 2006–2023 period into four
                    distinct contributing factors:
                </Typography>
                <Typography variant="body1" component="div" sx={{ pl: 2 }}>
                    <ul>
                        <li><strong>Population Growth:</strong> Changes due to increases or decreases in total population size
                        (more people at risk means potentially more deaths, even with constant pollution and mortality rates)</li>
                        <li><strong>Population Aging:</strong> Changes due to demographic shifts in age distribution (older
                        populations are generally more vulnerable to air pollution)</li>
                        <li><strong>Exposure Change:</strong> Changes due to increases or decreases in PM₂.₅ concentration
                        levels (the environmental factor)</li>
                        <li><strong>Baseline Mortality Rate Change:</strong> Changes in underlying mortality rates unrelated
                        to PM₂.₅ (improvements in healthcare, changes in chronic disease prevalence, etc.)</li>
                    </ul>
                </Typography>
                <Typography variant="body1" paragraph>
                    This decomposition helps identify whether mortality changes are driven primarily by environmental factors
                    (pollution levels) or demographic factors (population size and age structure). For example, a county
                    might show increasing PM₂.₅-attributable deaths primarily due to population growth and aging, even if
                    actual PM₂.₅ levels have decreased.
                </Typography>

                <Typography variant="h6" sx={{ fontWeight: 600, mt: 3, mb: 1 }}>
                    How should I interpret the bar charts for different time scales?
                </Typography>
                <Typography variant="body1" paragraph>
                    When viewing yearly data, the bar charts show annual averages from 2006–2023, helping identify long-term
                    trends. For monthly or seasonal views, the charts display daily PM₂.₅ levels within the selected period,
                    revealing short-term variability and peak pollution days. For mortality data, charts always show annual
                    estimates regardless of the time scale selected for PM₂.₅ layers.
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

            <Paper elevation={2} sx={{ p: 4, mb: 4, ml: 4, mr: 4 }}>
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

            <Paper elevation={2} sx={{ p: 4, ml: 4, mr: 4 }}>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: '#333' }}>
                    Useful Resources
                </Typography>
                <Typography variant="body1" paragraph>
                    For additional information on air quality monitoring, wildfire smoke tracking, and regulatory guidance:
                </Typography>
                <Typography variant="body1" component="div" sx={{ pl: 2 }}>
                    <ul>
                        <li>
                            <Link href="https://www.ospo.noaa.gov/Products/land/hms.html" target="_blank" rel="noopener noreferrer" sx={{ color: '#1976d2', textDecoration: 'underline' }}>
                                NOAA Hazard Mapping System (HMS) Fire and Smoke Product
                            </Link> — Real-time satellite detection of smoke plumes and wildfires across North America
                        </li>
                        <li>
                            <Link href="https://www.epa.gov/aqs" target="_blank" rel="noopener noreferrer" sx={{ color: '#1976d2', textDecoration: 'underline' }}>
                                EPA Air Quality System (AQS)
                            </Link> — National database of air quality monitoring data from thousands of stations
                        </li>
                        <li>
                            <Link href="https://www.epa.gov/air-quality-analysis/treatment-air-quality-monitoring-data-influenced-exceptional-events" target="_blank" rel="noopener noreferrer" sx={{ color: '#1976d2', textDecoration: 'underline' }}>
                                EPA Exceptional Events Rule
                            </Link> — Guidance on how exceptional events like wildfires are treated in air quality regulatory determinations
                        </li>
                        <li>
                            <Link href="https://www.airnow.gov/" target="_blank" rel="noopener noreferrer" sx={{ color: '#1976d2', textDecoration: 'underline' }}>
                                AirNow
                            </Link> — EPA's real-time air quality index and forecasts for communities across the U.S.
                        </li>
                        <li>
                            <Link href="https://www.who.int/news-room/fact-sheets/detail/ambient-(outdoor)-air-quality-and-health" target="_blank" rel="noopener noreferrer" sx={{ color: '#1976d2', textDecoration: 'underline' }}>
                                WHO Air Quality Guidelines
                            </Link> — World Health Organization's evidence-based recommendations for air quality standards
                        </li>
                    </ul>
                </Typography>
            </Paper>
        </Container>
    );
}

export default About; 