import React from 'react';
import { FormControl, FormLabel, RadioGroup, FormControlLabel, Radio, Typography, Paper } from '@mui/material';

const LayerControl = ({ activeLayer, onLayerChange }) => {
  const handleChange = (event) => {
    onLayerChange(event.target.value);
  };

  return (
    <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
      <FormControl component="fieldset">
        <FormLabel component="legend">
          <Typography variant="subtitle1" fontWeight="bold">Map Layer</Typography>
        </FormLabel>
        <RadioGroup
          aria-label="map-layer"
          name="map-layer"
          value={activeLayer}
          onChange={handleChange}
        >
          <FormControlLabel
            value="avg_total_pm25"
            control={<Radio size="small" />}
            label="Total PM2.5 (µg/m³)"
          />
          <FormControlLabel
            value="fire_pm25"
            control={<Radio size="small" />}
            label="Fire-attributed PM2.5 (µg/m³)"
          />
        </RadioGroup>
      </FormControl>
    </Paper>
  );
};

export default React.memo(LayerControl);
