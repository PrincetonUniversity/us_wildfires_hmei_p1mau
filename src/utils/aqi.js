// EPA PM2.5 AQI breakpoints, categories, and colors
const AQI_BREAKPOINTS = [
    { pmLow: 0.0, pmHigh: 9.0, aqiLow: 0, aqiHigh: 50, category: 'Good', color: '#00e400' },
    { pmLow: 9.1, pmHigh: 35.4, aqiLow: 51, aqiHigh: 100, category: 'Moderate', color: '#ffff00' },
    { pmLow: 35.5, pmHigh: 55.4, aqiLow: 101, aqiHigh: 150, category: 'Unhealthy for SG', color: '#ff7e00' },
    { pmLow: 55.5, pmHigh: 125.4, aqiLow: 151, aqiHigh: 200, category: 'Unhealthy', color: '#ff0000' },
    { pmLow: 125.5, pmHigh: 225.4, aqiLow: 201, aqiHigh: 300, category: 'Very Unhealthy', color: '#8f3f97' },
    { pmLow: 225.5, pmHigh: 500.4, aqiLow: 301, aqiHigh: 500, category: 'Hazardous', color: '#7e0023' },
];

export function pm25ToAqiInfo(pm25) {
    if (pm25 == null || isNaN(pm25)) return { aqi: null, category: 'Unknown', color: '#cccccc' };
    // Truncate to 1 decimal place as per EPA
    const Cp = Math.floor(pm25 * 10) / 10;
    for (const bp of AQI_BREAKPOINTS) {
        if (Cp >= bp.pmLow && Cp <= bp.pmHigh) {
            // EPA formula: I = (I_Hi - I_Lo)/(BP_Hi - BP_Lo) * (Cp - BP_Lo) + I_Lo
            const aqi = Math.round(
                ((bp.aqiHigh - bp.aqiLow) / (bp.pmHigh - bp.pmLow)) * (Cp - bp.pmLow) + bp.aqiLow
            );
            return { aqi, category: bp.category, color: bp.color };
        }
    }
    // If above highest breakpoint
    const last = AQI_BREAKPOINTS[AQI_BREAKPOINTS.length - 1];
    return { aqi: 500, category: last.category, color: last.color };
} 