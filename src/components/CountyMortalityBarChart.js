import React, { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList } from "recharts";

const COLORS = {
    nonFire: "#90caf9", // blue
    fire: "#ffb74d",    // orange
};

function CountyMortalityBarChartContent({ data, timeScale = 'yearly', yllMode = false, zoomed, containerWidth = 420 }) {
    // Format data
    const formattedData = data.map(item => {
        // Use Years of Life Lost values if yllMode, otherwise deaths
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
    const chartWidth = zoomed ? 760 : Math.min(containerWidth - 20, 350); // Leave 20px padding
    const chartHeight = zoomed ? 350 : 180;

    // Tooltip
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const total = (payload[0].value + payload[1].value).toFixed(1);
            return (
                <div style={{ backgroundColor: 'white', padding: 8, border: '1px solid #ccc', borderRadius: 4, fontSize: 12 }}>
                    <p style={{ margin: 0, fontWeight: 'bold' }}>Year {label}</p>
                    <p style={{ margin: 0, color: COLORS.fire }}>{yllMode ? 'Smoke-attributed Years of Life Lost:' : 'Smoke-attributed:'} {payload[1].value.toFixed(1)} {yllMode ? 'Years of Life Lost' : 'deaths/year'}</p>
                    <p style={{ margin: 0, color: COLORS.nonFire }}>{yllMode ? 'Non-smoke Years of Life Lost:' : 'Non-smoke:'} {payload[0].value.toFixed(1)} {yllMode ? 'Years of Life Lost' : 'deaths/year'}</p>
                    <p style={{ margin: 0, fontWeight: 'bold' }}>Total: {total} {yllMode ? 'Years of Life Lost' : 'deaths/year'}</p>
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
                    tick={{ fontSize: zoomed ? 11 : 9 }}
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
                    tick={{ fontSize: zoomed ? 11 : 9 }}
                    width={35}
                    label={{
                        value: yllMode ? 'Years of Life Lost' : 'Excess Mortality (deaths/year)',
                        angle: -90,
                        position: 'insideLeft',
                        style: { textAnchor: 'middle', fontSize: zoomed ? 11 : 9 },
                        offset: 0
                    }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: zoomed ? 11 : 9 }} />
                <Bar
                    dataKey="nonFire"
                    stackId="a"
                    name={yllMode ? 'Non-smoke Years of Life Lost' : 'Non-smoke'}
                    fill={COLORS.nonFire}
                />
                <Bar
                    dataKey="fire"
                    stackId="a"
                    name={yllMode ? 'Smoke-attributed Years of Life Lost' : 'Smoke-attributed'}
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
                                    fontSize={zoomed ? 11 : 9}
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

export default function CountyMortalityBarChart({ data, timeScale = 'yearly', yllMode = false, containerWidth = 420, onExpand, isExpanded = false }) {
    const [zoomed, setZoomed] = useState(isExpanded);

    // Update zoomed state when isExpanded prop changes
    useEffect(() => {
        setZoomed(isExpanded);
    }, [isExpanded]);

    // Calculate responsive dimensions based on container width
    const chartWidth = zoomed ? 760 : Math.min(containerWidth - 10, containerWidth);

    return (
        <div
            style={{
                width: '100%',
                maxWidth: Math.min(containerWidth - 10, containerWidth),
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0,
            }}
        >
            {/* Chart box with relative positioning */}
            <div style={{
                width: 'fit-content',
                maxWidth: '100%',
                position: 'relative',
                background: '#f7f8fa',
                borderRadius: 8,
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                padding: 12,
                marginBottom: 0,
                minWidth: 0,
                overflow: 'hidden'
            }}>
                {/* Main chart content */}
                <div style={{ width: '100%', minWidth: 0, overflowX: 'auto' }}>
                    <CountyMortalityBarChartContent
                        data={data}
                        timeScale={timeScale}
                        yllMode={yllMode}
                        zoomed={false}
                        containerWidth={containerWidth}
                    />
                </div>
            </div>
            {/* Modal overlay for zoomed chart */}
            {zoomed && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        background: 'rgba(0,0,0,0.25)',
                        zIndex: 2000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <div
                        style={{
                            background: '#fff',
                            borderRadius: 10,
                            boxShadow: '0 8px 32px 0 rgba(30,34,90,0.18)',
                            padding: 32,
                            position: 'relative',
                            minWidth: 720,
                            maxWidth: '90vw',
                            maxHeight: '90vh',
                            overflow: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                        }}
                    >
                        <button
                            onClick={() => {
                                setZoomed(false);
                                if (onExpand) onExpand(); // Notify parent that chart is closed
                            }}
                            title="Close"
                            style={{
                                position: 'absolute',
                                top: 16,
                                right: 16,
                                background: 'transparent',
                                border: 'none',
                                fontSize: 28,
                                color: '#888',
                                cursor: 'pointer',
                                zIndex: 2
                            }}
                        >
                            ×
                        </button>
                        {/* Render only the chart content */}
                        <CountyMortalityBarChartContent 
                            data={data} 
                            timeScale={timeScale} 
                            yllMode={yllMode}
                            zoomed={true} 
                            containerWidth={chartWidth} 
                        />
                    </div>
                </div>
            )}
        </div>
    );
} 