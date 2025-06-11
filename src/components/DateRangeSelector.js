import React from 'react';
import { Paper, Typography, Box, Button, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';

const DateRangeSelector = ({ startDate, endDate, onDateChange, onSubmit, timeScale, onTimeScaleChange }) => {
    const renderDateSelectors = () => {
        switch (timeScale) {
            case 'yearly':
                return (
                    <DatePicker
                        label="Year"
                        value={startDate}
                        onChange={(newValue) => onDateChange('start', newValue)}
                        views={['year']}
                        slotProps={{ textField: { size: 'small' } }}
                    />
                );
            case 'seasonal':
                return (
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                            <InputLabel>Season</InputLabel>
                            <Select
                                value={startDate.getMonth()}
                                label="Season"
                                onChange={(e) => {
                                    const newDate = new Date(startDate);
                                    newDate.setMonth(e.target.value);
                                    onDateChange('start', newDate);
                                }}
                            >
                                <MenuItem value={11}>Winter</MenuItem>
                                <MenuItem value={2}>Spring</MenuItem>
                                <MenuItem value={5}>Summer</MenuItem>
                                <MenuItem value={8}>Fall</MenuItem>
                            </Select>
                        </FormControl>
                        <DatePicker
                            label="Year"
                            value={startDate}
                            onChange={(newValue) => onDateChange('start', newValue)}
                            views={['year']}
                            slotProps={{ textField: { size: 'small' } }}
                        />
                    </Box>
                );
            case 'monthly':
                return (
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                            <InputLabel>Month</InputLabel>
                            <Select
                                value={startDate.getMonth()}
                                label="Month"
                                onChange={(e) => {
                                    const newDate = new Date(startDate);
                                    newDate.setMonth(e.target.value);
                                    onDateChange('start', newDate);
                                }}
                            >
                                <MenuItem value={0}>January</MenuItem>
                                <MenuItem value={1}>February</MenuItem>
                                <MenuItem value={2}>March</MenuItem>
                                <MenuItem value={3}>April</MenuItem>
                                <MenuItem value={4}>May</MenuItem>
                                <MenuItem value={5}>June</MenuItem>
                                <MenuItem value={6}>July</MenuItem>
                                <MenuItem value={7}>August</MenuItem>
                                <MenuItem value={8}>September</MenuItem>
                                <MenuItem value={9}>October</MenuItem>
                                <MenuItem value={10}>November</MenuItem>
                                <MenuItem value={11}>December</MenuItem>
                            </Select>
                        </FormControl>
                        <DatePicker
                            label="Year"
                            value={startDate}
                            onChange={(newValue) => onDateChange('start', newValue)}
                            views={['year']}
                            slotProps={{ textField: { size: 'small' } }}
                        />
                    </Box>
                );
            case 'daily':
                return (
                    <DatePicker
                        label="Date"
                        value={startDate}
                        onChange={(newValue) => onDateChange('start', newValue)}
                        slotProps={{ textField: { size: 'small' } }}
                    />
                );
            case 'period':
            default:
                return (
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <DatePicker
                            label="Start Date"
                            value={startDate}
                            onChange={(newValue) => onDateChange('start', newValue)}
                            maxDate={endDate}
                            slotProps={{ textField: { size: 'small' } }}
                        />
                        <DatePicker
                            label="End Date"
                            value={endDate}
                            onChange={(newValue) => onDateChange('end', newValue)}
                            minDate={startDate}
                            slotProps={{ textField: { size: 'small' } }}
                        />
                    </Box>
                );
        }
    };

    return (
        <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Data View
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControl size="small">
                    <InputLabel>Time Scale</InputLabel>
                    <Select
                        value={timeScale}
                        label="Time Scale"
                        onChange={(e) => onTimeScaleChange(e.target.value)}
                    >
                        <MenuItem value="daily">Daily</MenuItem>
                        <MenuItem value="monthly">Monthly</MenuItem>
                        <MenuItem value="seasonal">Seasonal</MenuItem>
                        <MenuItem value="yearly">Yearly</MenuItem>
                        <MenuItem value="period">Custom Period</MenuItem>
                    </Select>
                </FormControl>

                <LocalizationProvider dateAdapter={AdapterDateFns}>
                    {renderDateSelectors()}
                </LocalizationProvider>

                <Button
                    variant="contained"
                    onClick={onSubmit}
                    sx={{ mt: 1 }}
                >
                    Update Map
                </Button>
            </Box>
        </Paper>
    );
};

export default React.memo(DateRangeSelector); 