import React, { useState, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import LayerTimeControls from './LayerTimeControls';
import CountyInfoPanel from './CountyInfoPanel';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';

const AGE_GROUPS = [
    { value: 1, label: '0-4' },
    { value: 2, label: '5-9' },
    { value: 3, label: '10-14' },
    { value: 4, label: '15-19' },
    { value: 5, label: '20-24' },
    { value: 6, label: '25-29' },
    { value: 7, label: '30-34' },
    { value: 8, label: '35-39' },
    { value: 9, label: '40-44' },
    { value: 10, label: '45-49' },
    { value: 11, label: '50-54' },
    { value: 12, label: '55-59' },
    { value: 13, label: '60-64' },
    { value: 14, label: '65-69' },
    { value: 15, label: '70-74' },
    { value: 16, label: '75-79' },
    { value: 17, label: '80-84' },
    { value: 18, label: '85+' },
];

const EXCEEDANCE_LAYERS = ['exceedance_8', 'exceedance_9'];

const Sidebar = ({
    activeLayer,
    setActiveLayer,
    pm25SubLayer,
    setPm25SubLayer,
    timeControls,
    setTimeControls,
    selectedCounty,
    hoveredCounty,
    loading,
    onClearSelectedCounty,
    selectedAgeGroups,
    setSelectedAgeGroups,
    mortalitySubMetric,
    setMortalitySubMetric,
    onWidthChange
}) => {
    const [sidebarWidth, setSidebarWidth] = useState(400); // Reduced from 500 to 400
    const [isDragging, setIsDragging] = useState(false);
    const dragStartX = useRef(0);
    const dragStartWidth = useRef(0);

    // Notify parent when width changes
    useEffect(() => {
        if (onWidthChange) {
            // Debounce the width change to prevent too frequent map updates during dragging
            const timeoutId = setTimeout(() => {
                onWidthChange(sidebarWidth);
            }, isDragging ? 100 : 0);

            return () => clearTimeout(timeoutId);
        }
    }, [sidebarWidth, onWidthChange, isDragging]);

    const handleMouseDown = (e) => {
        setIsDragging(true);
        dragStartX.current = e.clientX;
        dragStartWidth.current = sidebarWidth;
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;

        const deltaX = dragStartX.current - e.clientX;
        const newWidth = Math.max(350, Math.min(500, dragStartWidth.current + deltaX));
        setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    };

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);

            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging]);

    const handleChange = (event) => {
        let value = event.target.value;
        if (value.includes('all')) {
            if (selectedAgeGroups.length === AGE_GROUPS.length) {
                // If all are selected, clicking 'All' unselects all
                setSelectedAgeGroups([]);
            } else {
                // Otherwise, select all
                setSelectedAgeGroups(AGE_GROUPS.map(g => g.value));
            }
        } else {
            // Convert all values to numbers
            const selected = value.map(v => Number(v));
            setSelectedAgeGroups(selected);
        }
    };
    const isAllSelected = selectedAgeGroups.length === AGE_GROUPS.length;
    const isNoneSelected = selectedAgeGroups.length === 0;
    const allValues = AGE_GROUPS.map(g => String(g.value));
    return (
        <Box
            sx={{
                width: sidebarWidth,
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
            {/* Drag handle */}
            <Box
                sx={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: '4px',
                    cursor: 'ew-resize',
                    backgroundColor: 'transparent',
                    '&:hover': {
                        backgroundColor: 'rgba(0, 0, 0, 0.1)',
                    },
                    '&:active': {
                        backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    },
                    zIndex: 20,
                }}
                onMouseDown={handleMouseDown}
            />

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
                {/* Age group dropdown for mortality and Years of Life Lost layers, below sub-metric pill, above time controls */}
                {!(EXCEEDANCE_LAYERS.includes(activeLayer)) && (activeLayer === 'mortality' || activeLayer === 'yll') && (
                    <Box sx={{ mt: 1, mb: 1 }}>
                        <FormControl fullWidth size="small" variant="outlined">
                            <InputLabel id="age-group-label" shrink>Age Group</InputLabel>
                            <Select
                                labelId="age-group-label"
                                label="Age Group"
                                multiple
                                value={isNoneSelected ? [] : selectedAgeGroups.map(String)}
                                onChange={handleChange}
                                renderValue={(selected) => {
                                    if (selected.length === 0) return 'None';
                                    if (selected.length === AGE_GROUPS.length) return 'All Age Groups';
                                    return AGE_GROUPS.filter(g => selected.includes(String(g.value))).map(g => g.label).join(', ');
                                }}
                            >
                                <MenuItem value="all">
                                    <Checkbox checked={isAllSelected} indeterminate={false} />
                                    <ListItemText primary="All Age Groups" />
                                </MenuItem>
                                {AGE_GROUPS.map(group => (
                                    <MenuItem key={group.value} value={String(group.value)}>
                                        <Checkbox checked={selectedAgeGroups.includes(group.value)} />
                                        <ListItemText primary={group.label} />
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>
                )}
                {/* Always show time controls below, except for exceedance layers */}
                {!(EXCEEDANCE_LAYERS.includes(activeLayer)) && (
                    <LayerTimeControls
                        activeLayer={activeLayer}
                        setActiveLayer={setActiveLayer}
                        pm25SubLayer={pm25SubLayer}
                        setPm25SubLayer={setPm25SubLayer}
                        timeControls={timeControls}
                        setTimeControls={setTimeControls}
                        showTimeControls={true}
                    />
                )}
            </Paper>
            {/* Bottom: County Info */}
            <Box sx={{
                flex: '1 1 auto',
                minHeight: 0,
                maxHeight: 'calc(100vh - 250px)',
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
                <CountyInfoPanel
                    selectedCounty={hoveredCounty || selectedCounty}
                    onClearSelectedCounty={selectedCounty ? onClearSelectedCounty : null}
                    sidebarWidth={sidebarWidth}
                />
            </Box>
        </Box>
    );
};

export default Sidebar; 