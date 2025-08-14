import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList, ReferenceLine, Cell } from "recharts";

const COLORS = {
    population_growth: "#4e79a7",      // blue
    population_ageing: "#f28e2b",      // orange
    baseline_mortality_change: "#59a14f", // green
    exposure_change: "#e15759",         // red
    total_change: "#5f7d7aff" // gray
};

export default function CountyDecompositionChart({ decompositionData, containerWidth = 420 }) {
    if (!decompositionData) {
        return (
            <div style={{
                width: '100%',
                maxWidth: containerWidth,
                height: 200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#666',
                fontSize: '14px'
            }}>
                No decomposition data available
            </div>
        );
    }

    // Calculate responsive dimensions
    const chartWidth = Math.min(containerWidth - 20, 400); // Leave 20px padding
    const chartHeight = 200;

    // Format data for the chart
    const chartData = [
        {
            factor: "Population Growth",
            contribution: decompositionData.population_growth,
            color: COLORS.population_growth
        },
        {
            factor: "Population Ageing",
            contribution: decompositionData.population_ageing,
            color: COLORS.population_ageing
        },
        {
            factor: "Baseline Mortality Change",
            contribution: decompositionData.baseline_mortality_change,
            color: COLORS.baseline_mortality_change
        },
        {
            factor: "Exposure Change",
            contribution: decompositionData.exposure_change,
            color: COLORS.exposure_change
        },
        {
            factor: "Total Change",
            contribution: decompositionData.total_change,
            color: COLORS.total_change
        }
    ];



    // Calculate total change for percentage calculations
    const totalChange = decompositionData.total_change;

    // Add percentage values
    const dataWithPercentages = chartData.map(item => ({
        ...item,
        percentage: item.contribution
        // percentage: totalChange !== 0 ? (item.contribution / totalChange) * 100 : 0
    }));

    // Custom tooltip
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;

            // Descriptions for each factor
            const descriptions = {
                "Population Growth": (percentage) => `Increased population size contributed ${percentage.toFixed(1)}% to the change in PM2.5-related deaths.`,
                "Population Ageing": (percentage) => `An aging population contributed ${percentage.toFixed(1)}% to the change in PM2.5-related deaths.`,
                "Baseline Mortality Change": (percentage) => `Changes in overall health and declining baseline mortality rates, resulted in a ${percentage.toFixed(1)}% change in PM2.5-related deaths.`,
                "Exposure Change": (percentage) => `Increased ambient PM2.5 concentrations contributed ${percentage.toFixed(1)}% to the change in PM2.5-related deaths.`
            };

            const descriptionFn = descriptions[data.factor];
            const description = descriptionFn ? descriptionFn(data.percentage) : "";

            return (
                <div style={{
                    backgroundColor: 'white',
                    padding: 12,
                    border: '1px solid #ccc',
                    borderRadius: 6,
                    fontSize: 12,
                    maxWidth: 280,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                }}>
                    <p style={{ margin: 0, fontWeight: 'bold', color: data.color, fontSize: 13 }}>
                        {data.factor}
                    </p>

                    <p style={{ margin: '8px 0 0 0', lineHeight: 1.4, color: '#555' }}>
                        {description}
                    </p>
                </div>
            );
        }
        return null;
    };

    // Find the range for Y-axis - ensure we have reasonable bounds with nice tick intervals
    const maxAbsValue = Math.max(...dataWithPercentages.map(d => Math.abs(d.percentage)));
    const maxRange = Math.max(maxAbsValue * 1.1, 50);
    // Round up to nearest 50 or 100 for nice tick intervals
    const tickInterval = maxRange <= 100 ? 50 : 100;
    const roundedMax = Math.ceil(maxRange / tickInterval) * tickInterval;
    const yDomain = [-roundedMax, roundedMax];

    return (
        <div style={{ width: '100%', maxWidth: containerWidth, boxSizing: 'border-box' }}>
            <BarChart
                width={chartWidth}
                height={chartHeight}
                data={dataWithPercentages}
                margin={{ top: 20, right: 30, left: 20, bottom: 50 }}
                barSize={30}
            >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                    dataKey="factor"
                    tick={{ fontSize: 10 }}
                    height={80}
                    angle={-45}
                    textAnchor="end"
                    interval={0}
                    dy={10}
                />
                <YAxis
                    domain={yDomain}
                    tick={{ fontSize: 9 }}
                    width={50}
                    tickFormatter={(value) => `${value.toFixed(0)}%`}
                    ticks={Array.from({ length: Math.floor(yDomain[1] / tickInterval) * 2 + 1 }, (_, i) => -roundedMax + i * tickInterval)}
                    label={{
                        value: 'Contribution to Total Change (%)',
                        angle: -90,
                        position: 'insideLeft',
                        style: { textAnchor: 'middle', fontSize: 9 },
                        offset: 0
                    }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                    dataKey="percentage"
                    stroke="#000"
                    strokeWidth={1}
                    fill="#4e79a7"
                >
                    {dataWithPercentages.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}                    <LabelList
                        content={({ x, y, width, value, index }) => {
                            const data = dataWithPercentages[index];
                            const isPositive = value >= 0;
                            return (
                                <text
                                    x={x + width / 2}
                                    y={isPositive ? y - 5 : y + 15}
                                    fill="#666"
                                    textAnchor="middle"
                                    fontSize={9}
                                >
                                    {value.toFixed(1)}%
                                </text>
                            );
                        }}
                        position="top"
                    />
                </Bar>
                {/* Reference line at y=0 */}
                <ReferenceLine y={0} stroke="#000" strokeWidth={1.5} />
            </BarChart>
        </div>
    );
} 