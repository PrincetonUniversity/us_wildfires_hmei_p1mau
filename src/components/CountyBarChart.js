import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, LabelList } from "recharts";

const COLORS = {
  nonFire: "#90caf9", // blue
  fire: "#ffb74d",    // orange
};

export default function CountyBarChart({ data, timeScale }) {
  // Ensure data is properly formatted
  const formattedData = data.map(item => {
    // Handle both 'nonFire' and 'nonfire' property names
    const nonFireValue = item.nonFire !== undefined ? item.nonFire : item.nonfire;
    return {
      ...item,
      fire: Math.max(0, Number(item.fire) || 0),
      nonFire: Math.max(0, Number(nonFireValue) || 0)
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

  // Custom tooltip formatter
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const total = (payload[0].value + payload[1].value).toFixed(2);

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
          <p style={{ margin: 0, color: COLORS.fire }}>
            Fire PM2.5: {payload[1].value.toFixed(2)} µg/m³
          </p>
          <p style={{ margin: 0, color: COLORS.nonFire }}>
            Non-Fire PM2.5: {payload[0].value.toFixed(2)} µg/m³
          </p>
          <p style={{ margin: 0, fontWeight: 'bold' }}>
            Total: {total} µg/m³
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{
      width: containerWidth,
      height: 180,
      boxSizing: 'border-box',
      overflowX: timeScale !== 'yearly' && chartWidth > containerWidth ? 'auto' : 'visible'
    }}>
      <BarChart
        width={chartWidth}
        height={180}
        data={chartData}
        margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
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
            offset: -15
          }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 9 }} />
        <Bar dataKey="nonFire" stackId="a" fill={COLORS.nonFire} name="Non-Fire PM2.5" />
        <Bar
          dataKey="fire"
          stackId="a"
          fill={COLORS.fire}
          name="Fire PM2.5"
          isAnimationActive={false}
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
            position: 'left',
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
            position: 'left',
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