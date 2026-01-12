import React from 'react';
import { Typography, Paper, Container, Grid, Card, CardContent, Link, Box } from '@mui/material';

function Partners({ onTabChange }) {
    const developmentTeam = [
        {
            name: <a href="https://www.linkedin.com/in/hassan-khan-8534a6276/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>Hassan Khan</a>,
            description: "Led the development of the PM₂.₅ Wildfire Impact Map platform, including frontend interface design, data visualization implementation, and user experience optimization. Responsible for integrating multiple data sources and creating interactive mapping capabilities.",
            role: "Lead Developer & Project Manager",
            institution: "Princeton University, Computer Science, Class of 2027"
        },
        {
            name: <a href="https://mauzerall.scholar.princeton.edu/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>Mauzerall Research Group</a>,
            description: "This project was conducted under the direction of Professor Mauzerall’s research group, which oversaw the research process and supported all stages of project execution. The team provided critical guidance and feedback throughout the development process, including interface design and implementation, and will lead the preparation of the resulting research publication.",
            role: "Research Mentorship and Supervision",
            institution: "Princeton University — Civil and Environmental Engineering, and the Center for Policy Research on Energy and the Environment (C-PREE)"
        },
        /* {
            name: <a href="https://cpree.princeton.edu/people/yuanyu-xie" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>Yuanyu Xie</a>,
            description: "Main project supervisor and primary researcher for this project. Helped with data collection, developing research methods, and will be the lead author on the resulting research paper. Provided critical guidance throughout the development process.",
            role: "Project Supervisor",
            institution: "Princeton University, C-PREE Associate Research Scholar"
        },
        {
            name: <a href="https://mauzerall.scholar.princeton.edu/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>Denise Mauzerall</a>,
            description: "Professor and research group leader under whose guidance this project was conducted. Contributed to the research process and provided valuable feedback on interface development throughout the project lifecycle.",
            role: "Project Supervisor",
            institution: "Princeton University, Professor of Civil and Environmental Engineering and Public and International Affairs"
        }, */
        {
            name: <a href="https://www.linkedin.com/in/thomas-zhang-2493b5300/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>Thomas Zhang</a>,
            description: "Contributed to various parts of the interface development, particularly in areas where similar methods and approaches were used across our collaborative projects. Provided technical support and development assistance.",
            role: "Contributing Developer",
            institution: "Princeton University, Electrical and Computer Engineering, Class of 2028"
        }
    ];

    const academicPartners = [
        {
            name: <a href="https://cpree.princeton.edu/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>Center for Policy Research on Energy and the Environment (C-PREE)</a>,
            description: "C-PREE is an interdisciplinary research center at the Princeton School for Public and International Affairs dedicated to training the next generation of environmental and energy policy leaders. The center conducts rigorous research that integrates scientific knowledge with social science methodologies and practitioner insights, delivering practical solutions to the world's most pressing environmental and energy challenges.",
            role: "Research Group",
            institution: "Princeton University"
        },
        {
            name: <a href="https://environment.princeton.edu/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>High Meadows Environmental Institute (HMEI)</a>,
            description: "Princeton University's interdisciplinary environmental institute that brings together researchers, students, and external partners to address complex environmental challenges. HMEI provided research infrastructure, mentorship, and institutional support for this wildfire impact mapping project.",
            role: "Research Institution & Project Host",
            institution: "Princeton University"
        }
    ];

    const handleMethodologyClick = () => {
        if (onTabChange) {
            onTabChange('methodology');
        }
    };

    return (
        <Container maxWidth="lg" sx={{ py: 4, px: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom className="page-title" sx={{ ml: 4 }}>
                Partners
            </Typography>

            <Paper elevation={2} sx={{ p: 4, mb: 4, ml: 4, mr: 4 }}>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: '#333' }}>
                    Development Team
                </Typography>
                <Grid container spacing={3}>
                    {developmentTeam.map((member, index) => (
                        <Grid item xs={12} md={6} key={index}>
                            <Card elevation={1} sx={{ height: '100%' }}>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom className="partner-card-title">
                                        {member.name}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" gutterBottom>
                                        {member.role}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" gutterBottom>
                                        {member.institution}
                                    </Typography>
                                    <Typography variant="body1">
                                        {member.description}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            </Paper>

            <Paper elevation={2} sx={{ p: 4, mb: 4, ml: 4, mr: 4 }}>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: '#333' }}>
                    Academic Partners
                </Typography>
                <Grid container spacing={3}>
                    {academicPartners.map((partner, index) => (
                        <Grid item xs={12} md={6} key={index}>
                            <Card elevation={1} sx={{ height: '100%' }}>
                                <CardContent>
                                    <Box sx={{ display: 'flex', gap: 3 }}>
                                        {/* Logo on the left */}
                                        <Box sx={{ flexShrink: 0 }}>
                                            {partner.name.props.href.includes('environment.princeton.edu') && (
                                                <img
                                                    src="/hmei-logo.svg"
                                                    alt="HMEI Logo"
                                                    style={{ height: '40px', width: 'auto' }}
                                                />
                                            )}
                                            {partner.name.props.href.includes('cpree.princeton.edu') && (
                                                <img
                                                    src="/CPREE_PU_color_PMS-transparent.webp"
                                                    alt="CPREE Logo"
                                                    style={{ height: '40px', width: 'auto' }}
                                                />
                                            )}
                                        </Box>

                                        {/* Text content indented to the right */}
                                        <Box sx={{ flex: 1 }}>
                                            <Typography variant="h6" className="partner-card-title" gutterBottom>
                                                {partner.name}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                                {partner.role}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                                {partner.institution}
                                            </Typography>
                                        </Box>
                                    </Box>

                                    {/* Description below, not indented */}
                                    <Typography variant="body1" sx={{ mt: 2 }}>
                                        {partner.description}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            </Paper>

            <Paper elevation={2} sx={{ p: 4, ml: 4, mr: 4 }}>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: '#333' }}>
                    Project Support
                </Typography>
                <Typography variant="body1" paragraph>
                    This project represents a collaborative effort between Princeton University's research institutions,
                    combining technical development expertise with environmental science and policy research capabilities.
                    The platform serves as a demonstration of how academic research can be translated into accessible
                    tools for public health and environmental decision-making.
                </Typography>
                <Typography variant="body1">
                    For more information about the research methodology and data sources used in this project,
                    please visit the <Link component="button" onClick={handleMethodologyClick} sx={{ alignContent: 'center', textDecoration: 'underline', cursor: 'pointer', color: 'inherit' }}>Methodology</Link> section.
                </Typography>
            </Paper>
        </Container>
    );
}

export default Partners; 