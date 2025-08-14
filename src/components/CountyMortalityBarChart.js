import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList } from "recharts";

const COLORS = {
    nonFire: "#90caf9", // blue
    fire: "#ffb74d",    // orange
};

export default function CountyMortalityBarChart({ data, timeScale = 'yearly', yllMode = false, containerWidth = 420 }) {
    // Format data
    const formattedData = data.map(item => {
        // Use YLL values if yllMode, otherwise deaths
        const fire = Math.max(0, Number(yllMode ? item.yll_fire : item.fire) || 0);
        const nonFire = Math.max(0, Number(yllMode ? item.yll_nonfire : item.nonFire) || 0);
        return {
            ...item,
            fire,
            nonFire,
            total: fire + nonFire,
            label: item.year ? item.year.toString() : item.label
        };
    });

    // Sort by year
    const chartData = [...formattedData].sort((a, b) => (a.year || 0) - (b.year || 0));
    const maxValue = Math.max(10, ...chartData.map(d => d.total));
    const tickStep = Math.max(1, Math.ceil(maxValue / 6));
    const ticks = [];
    for (let t = 0; t <= maxValue; t += tickStep) ticks.push(t);

    // Calculate responsive dimensions
    const chartWidth = Math.min(containerWidth - 20, 350); // Leave 20px padding
    const chartHeight = 180;

    // Tooltip
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const total = (payload[0].value + payload[1].value).toFixed(1);
            return (
                <div style={{ backgroundColor: 'white', padding: 8, border: '1px solid #ccc', borderRadius: 4, fontSize: 12 }}>
                    <p style={{ margin: 0, fontWeight: 'bold' }}>Year {label}</p>
                    <p style={{ margin: 0, color: COLORS.fire }}>{yllMode ? 'Fire-attributed YLL:' : 'Fire-attributed:'} {payload[1].value.toFixed(1)} {yllMode ? 'YLL' : 'deaths/year'}</p>
                    <p style={{ margin: 0, color: COLORS.nonFire }}>{yllMode ? 'Non-fire YLL:' : 'Non-fire:'} {payload[0].value.toFixed(1)} {yllMode ? 'YLL' : 'deaths/year'}</p>
                    <p style={{ margin: 0, fontWeight: 'bold' }}>Total: {total} {yllMode ? 'YLL' : 'deaths/year'}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div style={{ width: '100%', maxWidth: containerWidth, boxSizing: 'border-box' }}>
            <BarChart
                width={chartWidth}
                height={chartHeight}
                data={chartData}
                margin={{ top: 20, right: 60, left: 5, bottom: 0 }}
                barSize={20}
            >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                    dataKey="label"
                    interval={0}
                    tick={{ fontSize: 9 }}
                    height={30}
                    tickFormatter={(label, index) => {
                        // Only show every 2 years (even years)
                        const year = parseInt(label, 10);
                        return year % 2 === 0 ? label : '';
                    }}
                />
                <YAxis
                    domain={[0, maxValue]}
                    ticks={ticks}
                    tick={{ fontSize: 9 }}
                    width={35}
                    label={{
                        value: yllMode ? 'Years of Life Lost (YLL)' : 'Excess Mortality (deaths/year)',
                        angle: -90,
                        position: 'insideLeft',
                        style: { textAnchor: 'middle', fontSize: 9 },
                        offset: 0
                    }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 9 }} />
                <Bar
                    dataKey="nonFire"
                    stackId="a"
                    name={yllMode ? 'Non-fire YLL' : 'Non-fire'}
                    fill={COLORS.nonFire}
                />
                <Bar
                    dataKey="fire"
                    stackId="a"
                    name={yllMode ? 'Fire-attributed YLL' : 'Fire-attributed'}
                    fill={COLORS.fire}
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
                                    fontSize={9}
                                >
                                    {total.toFixed(0)}
                                </text>
                            );
                        }}
                        position="top"
                    />
                </Bar>
            </BarChart>
        </div>
    );
} 