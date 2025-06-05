import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, LabelList } from "recharts";

const COLORS = {
  nonFire: "#90caf9", // blue
  fire: "#ffb74d",    // orange
};

// Custom label component for total value
const TotalLabel = (props) => {
  const { x, y, width, value } = props;
  const total = Number(value?.fire || 0) + Number(value?.nonFire || 0);

  return (
    <text
      x={x + width / 2}
      y={y - 5}
      fill="#666"
      textAnchor="middle"
      fontSize={12}
    >
      {total.toFixed(1)}
    </text>
  );
};

export default function CountyBarChart({ data }) {
  // Ensure data is properly formatted
  const formattedData = data.map(item => ({
    year: String(item.year),
    fire: Number(item.fire) || 0,
    nonFire: Number(item.nonFire) || 0
  }));

  // Filter out any bad data
  const filteredData = formattedData.filter(
    d => Number.isFinite(d.fire) && Number.isFinite(d.nonFire)
  );

  // Deep clone the chartData array to strip any hidden properties
  const chartData = JSON.parse(JSON.stringify(filteredData.map(d => ({
    year: d.year,
    fire: d.fire,
    nonFire: d.nonFire
  }))));

  // Calculate max value for Y axis
  const maxValue = Math.max(
    12, // Default max
    ...chartData.map(d => d.fire + d.nonFire)
  );

  // Generate Y-axis ticks up to maxValue
  const tickStep = 3;
  const ticks = [];
  for (let t = 0; t <= maxValue; t += tickStep) ticks.push(t);

  return (
    <div style={{ width: 250, height: 180, boxSizing: 'border-box' }}>
      <BarChart
        width={250}
        height={180}
        data={chartData}
        margin={{ top: 20, right: 10, left: 0, bottom: 20 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="year" />
        <YAxis
          domain={[0, maxValue]}
          ticks={ticks}
          label={{
            value: 'PM2.5 (µg/m³)',
            angle: -90,
            position: 'insideLeft',
            style: { textAnchor: 'middle' }
          }}
        />
        <Tooltip />
        <Legend />
        <Bar dataKey="nonFire" stackId="a" fill={COLORS.nonFire} name="Non-Fire PM2.5" />
        <Bar
          dataKey="fire"
          stackId="a"
          fill={COLORS.fire}
          name="Fire PM2.5"
          isAnimationActive={false}
        >
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
                  fontSize={12}
                >
                  {total.toFixed(1)}
                </text>
              );
            }}
            position="top"
          />
        </Bar>
        <ReferenceLine
          y={9}
          stroke="#d32f2f"
          strokeDasharray="6 3"
          label={{
            value: 'EPA Standard',
            position: 'left',
            fill: '#d32f2f',
            fontSize: 7,
            offset: 2
          }}
        />
      </BarChart>
    </div>
  );
}
