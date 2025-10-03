import React, { useMemo } from 'react';
import { Paper, Typography, Box, useTheme } from '@mui/material';

const Legend = ({ activeLayer }) => {
  const theme = useTheme();

  const legendData = useMemo(() => {
    if (activeLayer === 'avg_total_pm25') {
      return {
        title: 'Total PM2.5 (µg/m³)',
        colors: [
          { color: '#fff7bc', label: '0 µg/m³' },
          { color: '#fee391', label: '2.5 µg/m³' },
          { color: '#fec44f', label: '5 µg/m³' },
          { color: '#fe9929', label: '7.5 µg/m³' },
          { color: '#ec7014', label: '10 µg/m³' },
          { color: '#cc4c02', label: '12.5+ µg/m³' }
        ]
      };
    } else {
      return {
        title: 'Smoke PM2.5 (µg/m³)',
        colors: [
          { color: '#fff7bc', label: '0 µg/m³' },
          { color: '#fee391', label: '0.5 µg/m³' },
          { color: '#fec44f', label: '1.0 µg/m³' },
          { color: '#fe9929', label: '1.5 µg/m³' },
          { color: '#ec7014', label: '2.0 µg/m³' },
          { color: '#cc4c02', label: '2.5+ µg/m³' }
        ]
      };
    }
  }, [activeLayer]);

  return (
    <Paper elevation={1} sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
        {legendData.title}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {legendData.colors.map((item, index) => (
          <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 20,
                height: 20,
                backgroundColor: item.color,
                border: '1px solid #ccc'
              }}
            />
            <Typography variant="body2">{item.label}</Typography>
          </Box>
        ))}
      </Box>
      {activeLayer === 'avg_total_pm25' && (
        <Box mt={2} pt={2} borderTop={`1px solid ${theme.palette.divider}`}>
          <Typography variant="caption" color="text.secondary">
            {`Yellow border indicates PM2.5 > 9 µg/m³`}
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default React.memo(Legend);
