import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from "recharts";

const COLORS = {
  nonFire: "#90caf9", // blue
  fire: "#ffb74d",    // orange
};

export default function CountyBarChart({ data }) {
  // Debug log
  console.log('Bar chart data:', data);
  data.forEach((item, idx) => {
    console.log(`Year ${item.year}: fire=${item.fire} (${typeof item.fire}), nonFire=${item.nonFire} (${typeof item.nonFire})`);
  });

  // Ensure data is properly formatted
  const formattedData = data.map(item => ({
    year: String(item.year),
    fire: Number(item.fire) || 0,
    nonFire: Number(item.nonFire) || 0
  }));
  formattedData.forEach((item, idx) => {
    console.log(`BarChart formattedData[${idx}]:`, item);
  });

  // Filter out any bad data
  const filteredData = formattedData.filter(
    d => Number.isFinite(d.fire) && Number.isFinite(d.nonFire)
  );

  // Debug log for filtered data
  console.log('BarChart filteredData:', filteredData);

  // Deep clone the chartData array to strip any hidden properties
  const chartData = JSON.parse(JSON.stringify(filteredData.map(d => ({
    year: d.year,
    fire: d.fire,
    nonFire: d.nonFire
  }))));

  // Debug log for chartData
  console.log('BarChart chartData (full):', chartData);
  chartData.forEach((item, idx) => {
    Object.keys(item).forEach(key => {
      console.log(`chartData[${idx}][${key}]:`, item[key], typeof item[key]);
    });
  });

  // Calculate max value for Y axis
  const maxValue = Math.max(
    12, // Default max
    ...chartData.map(d => d.fire + d.nonFire)
  );

  // Debug log for Y axis
  console.log('BarChart maxValue:', maxValue);

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
        margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="year" />
        <YAxis domain={[0, maxValue]} ticks={ticks} />
        <Tooltip />
        <Legend />
        <ReferenceLine y={9} stroke="#d32f2f" strokeDasharray="6 3" label={{ value: 'Standard', position: 'top', fill: '#d32f2f', fontSize: 12 }} />
        <Bar dataKey="nonFire" stackId="a" fill={COLORS.nonFire} name="Non-Fire PM2.5" />
        <Bar dataKey="fire" stackId="a" fill={COLORS.fire} name="Fire PM2.5" />
      </BarChart>
    </div>
  );
}
