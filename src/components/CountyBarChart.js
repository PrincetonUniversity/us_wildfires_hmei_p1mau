import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, LabelList, Rectangle } from "recharts";
import { pm25ToAqiInfo } from '../utils/aqi';

const COLORS = {
  nonFire: "#90caf9", // blue
  fire: "#ffb74d",    // orange
};

// Custom shape for dynamic fill
const CustomBarShape = (props) => {
  const { fill, ...rest } = props;
  // Use fill from data if present
  const barFill = props.payload && props.payload[props.fillKey] ? props.payload[props.fillKey] : fill;
  return <Rectangle {...rest} fill={barFill} />;
};

// Helper to convert hex color to rgba
function hexToRgba(hex, alpha) {
  // Remove # if present
  hex = hex.replace('#', '');
  // Parse r, g, b
  const bigint = parseInt(hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function CountyBarChart({ data, timeScale }) {
  // Ensure data is properly formatted
  const formattedData = data.map(item => {
    // Handle both 'nonFire' and 'nonfire' property names
    const nonFireValue = item.nonFire !== undefined ? item.nonFire : item.nonfire;
    const fireValue = Math.max(0, Number(item.fire) || 0);
    const nonFireValueNum = Math.max(0, Number(nonFireValue) || 0);
    const totalPM25 = fireValue + nonFireValueNum;

    return {
      ...item,
      fire: fireValue,
      nonFire: nonFireValueNum,
      total: totalPM25
    };
  });

  // Filter out any bad data and sort appropriately
  const filteredData = formattedData
    .filter(d =>
      Number.isFinite(d.fire) &&
      Number.isFinite(d.nonFire) &&
      (d.label || d.timePeriod)
    )
    .sort((a, b) => {
      if (timeScale === 'yearly') {
        return parseInt(a.label) - parseInt(b.label);
      } else if (timeScale === 'seasonal') {
        // For seasonal data, handle winter months specially
        const [aMonth, aDay] = a.label.split('/').map(Number);
        const [bMonth, bDay] = b.label.split('/').map(Number);

        // If both are winter months (12, 1, or 2)
        if ((aMonth === 12 || aMonth <= 2) && (bMonth === 12 || bMonth <= 2)) {
          // December should come first
          if (aMonth === 12 && bMonth !== 12) return -1;
          if (bMonth === 12 && aMonth !== 12) return 1;
          // Then January
          if (aMonth === 1 && bMonth !== 1) return -1;
          if (bMonth === 1 && aMonth !== 1) return 1;
          // Then February
          if (aMonth === 2 && bMonth !== 2) return -1;
          if (bMonth === 2 && aMonth !== 2) return 1;
          // If same month, sort by day
          return aDay - bDay;
        }
        // For non-winter months, sort normally
        return new Date(a.date) - new Date(b.date);
      } else {
        // For daily data, sort by date
        return new Date(a.date) - new Date(b.date);
      }
    });

  // console.log('Processed bar chart data:', filteredData);

  // Deep clone the chartData array to strip any hidden properties
  const chartData = JSON.parse(JSON.stringify(filteredData));

  // Calculate max value for Y axis
  const maxValue = Math.max(
    12, // Default max
    ...chartData.map(d => d.fire + d.nonFire)
  );

  // Generate Y-axis ticks up to maxValue
  const tickStep = Math.max(1, Math.ceil(maxValue / 6));
  const ticks = [];
  for (let t = 0; t <= maxValue; t += tickStep) ticks.push(t);

  // Set a fixed container width for the popup
  const containerWidth = 420;
  // Adjust chart dimensions based on data length
  const chartWidth = timeScale === 'yearly' ? 350 :
    timeScale === 'monthly' ? Math.max(350, chartData.length * 8) :
      containerWidth; // Always fill popup for seasonal
  const barSize = timeScale === 'yearly' ? 20 :
    timeScale === 'monthly' ? Math.max(8, Math.min(15, 250 / chartData.length)) :
      Math.max(6, Math.min(18, Math.floor(containerWidth / chartData.length) - 1)); // Fill width for seasonal

  // Improved x-axis label logic to prevent overlap
  const formatXAxis = (tickItem, index) => {
    if (timeScale === 'yearly') {
      const year = parseInt(tickItem);
      return year % 2 === 0 ? year : '';
    } else {
      // For daily data, show dates in MM/DD format
      const [month, day] = tickItem.split('/');
      if (chartData.length <= 10) return tickItem;
      if (chartData.length <= 20) return index % 2 === 0 ? tickItem : '';
      if (chartData.length <= 40) return index % 5 === 0 ? tickItem : '';
      return index % 7 === 0 ? tickItem : '';
    }
  };

  // Assign fill colors to each data point
  const isDailyChart = timeScale === 'monthly' || timeScale === 'seasonal';

  if (isDailyChart) {
    // For daily charts (monthly/seasonal), use AQI-based colors with transparency
    chartData.forEach(d => {
      const aqiInfo = pm25ToAqiInfo(d.total);
      d.nonFireFill = hexToRgba(aqiInfo.color, 0.4); // 40% transparency for non-fire
      d.fireFill = hexToRgba(aqiInfo.color, 0.8);     // 80% transparency for fire (darker)
    });
  } else {
    // For yearly charts, use original colors
    chartData.forEach(d => {
      d.nonFireFill = COLORS.nonFire;
      d.fireFill = COLORS.fire;
    });
  }

  // console.log('chartData', chartData);

  // Custom tooltip formatter
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const total = (payload[0].value + payload[1].value).toFixed(2);
      const pm25 = data.total;
      const aqiInfo = pm25ToAqiInfo(pm25);

      let dateLabel = label;
      if (timeScale !== 'yearly' && data.date) {
        const date = new Date(data.date);
        dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }

      return (
        <div style={{
          backgroundColor: 'white',
          padding: '8px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>
            {timeScale === 'yearly' ? `Year ${dateLabel}` : dateLabel}
          </p>
          <p style={{ margin: 0, color: payload[1].payload.fireFill }}>
            Fire PM2.5: {payload[1].value.toFixed(2)} µg/m³
          </p>
          <p style={{ margin: 0, color: payload[0].payload.nonFireFill }}>
            Non-Fire PM2.5: {payload[0].value.toFixed(2)} µg/m³
          </p>
          <p style={{ margin: 0, fontWeight: 'bold' }}>
            Total: {total} µg/m³
          </p>
          {isDailyChart && (
            <>
              <p style={{ margin: 0, fontWeight: 'bold', color: aqiInfo.color }}>
                AQI: {aqiInfo.aqi} ({aqiInfo.category})
              </p>
            </>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{
      width: containerWidth,
      boxSizing: 'border-box',
      overflowX: timeScale !== 'yearly' && chartWidth > containerWidth ? 'auto' : 'visible'
    }}>

      <BarChart
        width={chartWidth}
        height={180}
        data={chartData}
        margin={{ top: 20, right: 60, left: 5, bottom: 0 }}
        barSize={barSize}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tickFormatter={formatXAxis}
          interval={0}
          tick={{ fontSize: 9 }}
          height={30}
        />
        <YAxis
          domain={[0, maxValue]}
          ticks={ticks}
          tick={{ fontSize: 9 }}
          width={35}
          label={{
            value: 'PM2.5 (µg/m³)',
            angle: -90,
            position: 'insideLeft',
            style: { textAnchor: 'middle', fontSize: 9 },
            offset: 0
          }}
        />
        <Tooltip content={<CustomTooltip />} />
        {/* Custom Legend */}
        {isDailyChart ? (
          <Legend
            wrapperStyle={{ fontSize: 9 }}
            content={({ payload }) => (
              <div style={{ textAlign: 'center', fontSize: 9, marginTop: 0 }}>
                <span style={{ marginRight: 15 }}>
                  <span style={{
                    display: 'inline-block',
                    width: 12,
                    height: 12,
                    backgroundColor: 'rgba(128,128,128,0.4)',
                    marginRight: 4,
                    verticalAlign: 'middle'
                  }}></span>
                  Non-Fire PM2.5 (AQI Color)
                </span>
                <span>
                  <span style={{
                    display: 'inline-block',
                    width: 12,
                    height: 12,
                    backgroundColor: 'rgba(128,128,128,0.8)',
                    marginRight: 4,
                    verticalAlign: 'middle'
                  }}></span>
                  Fire PM2.5 (AQI Color)
                </span>
              </div>
            )}
          />
        ) : (
          <Legend wrapperStyle={{ fontSize: 9 }} />
        )}
        <Bar
          dataKey="nonFire"
          stackId="a"
          name="Non-Fire PM2.5"
          fill={COLORS.nonFire}
          shape={(props) => <CustomBarShape {...props} fillKey="nonFireFill" />}
        />
        <Bar
          dataKey="fire"
          stackId="a"
          name="Fire PM2.5"
          isAnimationActive={false}
          fill={COLORS.fire}
          shape={(props) => <CustomBarShape {...props} fillKey="fireFill" />}
        >
          {/* Only show total labels for yearly data to avoid clutter */}
          {timeScale === 'yearly' && (
            <LabelList
              content={({ x, y, width, index }) => {
                const dataPoint = chartData[index];
                const total = dataPoint.fire + dataPoint.nonFire;
                return (
                  <text
                    x={x + width / 2}
                    y={y - 5}
                    fill="#666"
                    textAnchor="middle"
                    fontSize={9}
                  >
                    {total.toFixed(1)}
                  </text>
                );
              }}
              position="top"
            />
          )}
        </Bar>
        <ReferenceLine
          y={9}
          stroke="#d32f2f"
          strokeDasharray="6 3"
          label={{
            value: 'Annual Std.',
            position: 'right',
            fill: '#d32f2f',
            fontSize: 7,
            offset: 2
          }}
        />
        {maxValue > 35 && timeScale !== 'yearly' && (
          <ReferenceLine
            y={35}
            stroke="#d32f2f"
            strokeDasharray="10 5"
            label={{
              value: 'Daily Std.',
              position: 'right',
              fill: '#d32f2f',
              fontSize: 7,
              offset: 2
            }}
          />
        )}
      </BarChart>
    </div>
  );
}