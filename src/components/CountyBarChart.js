import React, { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, LabelList, Rectangle, PieChart, Pie, Cell } from "recharts";
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

function CountyBarChartContent({ data, timeScale, zoomed, containerWidth }) {
  // Ensure data is properly formatted
  const formattedData = data.map(item => {
    const nonFireValue = item.nonFire !== undefined ? item.nonFire : item.nonfire;
    const fireValue = Math.max(0, Number(item.fire) || 0);
    const nonFireValueNum = Math.max(0, Number(nonFireValue) || 0);
    const totalPM25 = fireValue + nonFireValueNum;
    return { ...item, fire: fireValue, nonFire: nonFireValueNum, total: totalPM25 };
  });

  const filteredData = formattedData
    .filter(d => Number.isFinite(d.fire) && Number.isFinite(d.nonFire) && (d.label || d.timePeriod))
    .sort((a, b) => {
      if (timeScale === 'yearly') return parseInt(a.label) - parseInt(b.label);
      if (timeScale === 'seasonal') {
        const [aMonth, aDay] = a.label.split('/').map(Number);
        const [bMonth, bDay] = b.label.split('/').map(Number);
        if ((aMonth === 12 || aMonth <= 2) && (bMonth === 12 || bMonth <= 2)) {
          if (aMonth === 12 && bMonth !== 12) return -1;
          if (bMonth === 12 && aMonth !== 12) return 1;
          if (aMonth === 1 && bMonth !== 1) return -1;
          if (bMonth === 1 && aMonth !== 1) return 1;
          if (aMonth === 2 && bMonth !== 2) return -1;
          if (bMonth === 2 && aMonth !== 2) return 1;
          return aDay - bDay;
        }
        return new Date(a.date) - new Date(b.date);
      }
      return new Date(a.date) - new Date(b.date);
    });

  const chartData = JSON.parse(JSON.stringify(filteredData));
  const maxValue = Math.max(12, ...chartData.map(d => d.fire + d.nonFire));
  const tickStep = Math.max(1, Math.ceil(maxValue / 6));
  const ticks = [];
  for (let t = 0; t <= maxValue; t += tickStep) ticks.push(t);

  // Define chart dimensions and daily chart flag
  const isDailyChart = timeScale === 'monthly' || timeScale === 'seasonal';

  const chartHeight = zoomed ? 350 : 200;
  const pieWidth = zoomed ? 350 : 200;
  const pieHeight = zoomed ? 260 : 160;

  const barSize = timeScale === 'yearly' ? 20 :
    timeScale === 'monthly' ? Math.max(10, Math.min(20, 300 / chartData.length)) :
      timeScale === 'seasonal' ? 8 :
        Math.max(8, Math.min(25, Math.floor(containerWidth / chartData.length) - 2));

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
  if (isDailyChart) {
    chartData.forEach(d => {
      const aqiInfo = pm25ToAqiInfo(d.total);
      d.nonFireFill = hexToRgba(aqiInfo.color, 0.4); // 40% transparency for non-fire
      d.fireFill = hexToRgba(aqiInfo.color, 1);     // 80% transparency for fire (darker)
    });
  } else {
    chartData.forEach(d => {
      d.nonFireFill = COLORS.nonFire;
      d.fireFill = COLORS.fire;
    });
  }

  // Pie chart
  let pieData = null;
  if (isDailyChart) {
    let fireSum = 0, nonFireSum = 0;
    chartData.forEach(d => {
      fireSum += d.fire;
      nonFireSum += d.nonFire;
    });
    pieData = [
      { name: 'Fire', value: fireSum },
      { name: 'Non-Fire', value: nonFireSum }
    ];
  }

  // Custom shape for daily bars: AQI color fill, black dots at bottom if fire > 0
  const CustomTotalBarShape = (props) => {
    const { payload, ...rest } = props;
    const hasFire = payload.fire > 0;
    const aqiInfo = pm25ToAqiInfo(payload.total);

    return (
      <g>
        <Rectangle
          {...rest}
          fill={aqiInfo.color}
        />
        {hasFire && (
          <circle
            cx={rest.x + rest.width / 2}
            cy={rest.y + rest.height - 2}
            r={2}
            fill="#000"
          />
        )}
      </g>
    );
  };

  // Custom tooltip formatter
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;
    let dateLabel = label;
    if (timeScale !== 'yearly' && data.date) {
      const date = new Date(data.date);
      dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    if (timeScale === 'daily') {
      const total = typeof payload[0].value === 'number' ? payload[0].value : data.total;
      const fire = typeof data.fire === 'number' ? data.fire : 0;
      const nonFire = typeof data.nonFire === 'number' ? data.nonFire : 0;
      const aqiInfo = pm25ToAqiInfo(total);

      // Create a darker version of the AQI color for better readability
      const getReadableColor = (color) => {
        // Only for yellow and very light colors that are hard to read on white
        if (color === '#ffff00' || color === '#fff7bc' || color === '#fee391' ||
          color === '#fec44f' || color === '#fe9929' || color === '#ec7014') {
          return '#8B4513'; // Saddle brown - much darker and more readable
        }
        return color;
      };

      const readableAqiColor = getReadableColor(aqiInfo.color);

      return (
        <div style={{
          backgroundColor: 'white',
          padding: '8px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>{dateLabel}</p>
          <p style={{ margin: 0 }}>
            <span style={{ fontWeight: 500 }}>Total PM2.5:</span> {total?.toFixed(2)} µg/m³
          </p>
          <p style={{ margin: 0 }}>
            <span style={{ color: '#ffb74d', fontWeight: 500 }}>Smoke:</span> {fire?.toFixed(2)} µg/m³
            {fire > 0 && <span style={{ color: '#000', marginLeft: 4 }}>(smoke impacted)</span>}
          </p>
          <p style={{ margin: 0 }}>
            <span style={{ color: '#000', fontWeight: 500 }}>Non-Smoke:</span> {nonFire?.toFixed(2)} µg/m³
          </p>
          <p style={{ margin: 0, fontWeight: 'bold', color: readableAqiColor }}>
            AQI: {aqiInfo.aqi} ({aqiInfo.category})
          </p>
        </div>
      );
    } else {
      const total = (payload[0]?.value || 0) + (payload[1]?.value || 0);
      const aqiInfo = pm25ToAqiInfo(total);

      // Create a darker version of the AQI color for better readability
      const getReadableColor = (color) => {
        // Only for yellow and very light colors that are hard to read on white
        if (color === '#ffff00' || color === '#fff7bc' || color === '#fee391' ||
          color === '#fec44f' || color === '#fe9929' || color === '#ec7014') {
          return '#8B4513'; // Saddle brown - much darker and more readable
        }
        return color;
      };

      const readableAqiColor = getReadableColor(aqiInfo.color);

      return (
        <div style={{
          backgroundColor: 'white',
          padding: '8px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>{timeScale === 'yearly' ? `Year ${dateLabel}` : dateLabel}</p>
          <p style={{ margin: 0, color: '#000' }}>
            Smoke PM2.5: {payload[1]?.value?.toFixed(2)} µg/m³
          </p>
          <p style={{ margin: 0, color: '#000' }}>
            Non-Smoke PM2.5: {payload[0]?.value?.toFixed(2)} µg/m³
          </p>
          <p style={{ margin: 0, fontWeight: 'bold' }}>
            Total: {total.toFixed(2)} µg/m³
          </p>
          <p style={{ margin: 0, fontWeight: 'bold', color: readableAqiColor }}>
            AQI: {aqiInfo.aqi} ({aqiInfo.category})
          </p>
        </div>
      );
    }
  };

  return (
    <>
      <div style={{ width: '100%' }}>
        <BarChart
          width={containerWidth}
          height={chartHeight}
          data={chartData}
          margin={{ top: 3, right: 50, left: 3, bottom: 3 }}
          barSize={barSize}
          barCategoryGap={timeScale === 'seasonal' ? 2 : undefined}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tickFormatter={formatXAxis}
            interval={0}
            tick={{ fontSize: 9 }}
            height={25}
          />
          <YAxis
            domain={[0, maxValue]}
            ticks={ticks}
            tick={{ fontSize: 9 }}
            width={30}
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
              content={() => (
                <div style={{ textAlign: 'left', fontSize: 9, marginTop: 0 }}>
                  <span>
                    <span style={{
                      display: 'inline-block',
                      width: 4,
                      height: 4,
                      backgroundColor: '#000',
                      borderRadius: '50%',
                      marginRight: 4,
                      verticalAlign: 'middle'
                    }}></span>
                    Smoke-impacted day
                  </span>
                </div>
              )}
            />
          ) : (
            <Legend wrapperStyle={{ fontSize: 9 }} />
          )}
          {isDailyChart ? (
            <Bar
              dataKey="total"
              name="Total PM2.5"
              shape={CustomTotalBarShape}
            />
          ) : (
            <>
              <Bar
                dataKey="nonFire"
                stackId="a"
                name="Non-Smoke PM2.5"
                fill={COLORS.nonFire}
                shape={(props) => <CustomBarShape {...props} fillKey="nonFireFill" />}
              />
              <Bar
                dataKey="fire"
                stackId="a"
                name="Smoke PM2.5"
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
            </>
          )}
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
      {/* AQI Legend for daily charts */}
      {isDailyChart && (
        <div className="chart-legend-container">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: 0, padding: 0, justifyContent: 'flex-start' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
              <span style={{ width: 14, height: 14, background: '#00e400', borderRadius: 3, display: 'inline-block', marginRight: 1, border: '1px solid #bbb', flex: '0 0 auto' }}></span>
              <span style={{ fontSize: 8, color: '#000' }}>Good</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
              <span style={{ width: 14, height: 14, background: '#ffff00', borderRadius: 3, display: 'inline-block', marginRight: 1, border: '1px solid #bbb', flex: '0 0 auto' }}></span>
              <span style={{ fontSize: 8, color: '#000' }}>Moderate</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
              <span style={{ width: 14, height: 14, background: '#ff7e00', borderRadius: 3, display: 'inline-block', marginRight: 1, border: '1px solid #bbb', flex: '0 0 auto' }}></span>
              <span style={{ fontSize: 8, color: '#000' }}>Unhealthy for SG</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
              <span style={{ width: 14, height: 14, background: '#ff0000', borderRadius: 3, display: 'inline-block', marginRight: 1, border: '1px solid #bbb', flex: '0 0 auto' }}></span>
              <span style={{ fontSize: 8, color: '#000' }}>Unhealthy</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
              <span style={{ width: 14, height: 14, background: '#8f3f97', borderRadius: 3, display: 'inline-block', marginRight: 1, border: '1px solid #bbb', flex: '0 0 auto' }}></span>
              <span style={{ fontSize: 8, color: '#000' }}>Very Unhealthy</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
              <span style={{ width: 14, height: 14, background: '#7e0023', borderRadius: 3, display: 'inline-block', marginRight: 1, border: '1px solid #bbb', flex: '0 0 auto' }}></span>
              <span style={{ fontSize: 8, color: '#000' }}>Hazardous</span>
            </span>
          </div>
        </div>
      )}
      {/* Pie chart for daily charts */}
      {isDailyChart && pieData && (
        <>
          <div style={{ fontSize: zoomed ? 22 : 16, margin: zoomed ? '24px 0 12px 0' : '16px 0 8px 0', textAlign: 'left', fontWeight: 600, width: '100%' }}>
            <span style={{ color: '#ffb74d', fontWeight: 700 }}>Smoke</span> vs <span style={{ color: '#90caf9', fontWeight: 700 }}>Non-Smoke</span> PM2.5
          </div>
          <div style={{ width: '100%', margin: '0 auto', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'visible' }}>
            <PieChart width={pieWidth} height={pieHeight} style={{ width: '100%', height: pieHeight, maxWidth: zoomed ? 350 : 220, margin: '0 auto', overflow: 'visible' }}>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={zoomed ? 90 : 50}
                label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                labelLine={true}
                isAnimationActive={false}
              >
                <Cell key="fire" fill="#ffb74d" />
                <Cell key="nonfire" fill="#90caf9" />
              </Pie>
            </PieChart>
          </div>
        </>
      )}
    </>
  );
}

export default function CountyBarChart({ data, timeScale, containerWidth = 420, onExpand, isExpanded = false }) {
  const [zoomed, setZoomed] = useState(isExpanded);

  // Update zoomed state when isExpanded prop changes
  useEffect(() => {
    setZoomed(isExpanded);
  }, [isExpanded]);

  // Calculate responsive dimensions based on container width
  const chartWidth = zoomed ? 760 : Math.min(containerWidth - 10, containerWidth); // Use almost full width
  const chartHeight = zoomed ? 350 : 200; // Slightly reduced height

  // Handle expand button click
  const handleExpand = () => {
    setZoomed(true);
    if (onExpand) onExpand();
  };

  return (
    <div
      style={{
        width: '100%',
        maxWidth: Math.min(containerWidth - 10, containerWidth),
        boxSizing: 'border-box',
        overflowX:
          timeScale !== 'yearly' && Math.max(350, data.length * 8) > Math.min(containerWidth - 10, containerWidth)
            ? 'auto'
            : 'visible',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0,
        background: undefined,
        borderRadius: undefined,
        boxShadow: undefined,
        zIndex: undefined
      }}
    >
      {/* Chart box with relative positioning for the zoom button */}
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
        {/* Main chart content with horizontal scroll for bar chart */}
        <div style={{ width: '100%', minWidth: 0, overflowX: 'auto' }}>
          <CountyBarChartContent
            data={data}
            timeScale={timeScale}
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
            {/* Render only the chart content, not another zoom button/modal */}
            <CountyBarChartContent data={data} timeScale={timeScale} zoomed={true} containerWidth={chartWidth} />
          </div>
        </div>
      )}
    </div>
  );
}