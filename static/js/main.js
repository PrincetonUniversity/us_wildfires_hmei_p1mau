let map;
let markers = [];
let currentPollutant = 'pm25';

function initMap() {
    map = L.map('map').setView([37.0902, -95.7129], 4);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: ' OpenStreetMap contributors'
    }).addTo(map);

    // Add zoom controls
    L.control.zoom().addTo(map);
}

async function loadPollutionData() {
    try {
        const response = await axios.get('/get_pollution_data');
        const data = response.data.data;
        
        // Clear existing markers
        markers.forEach(marker => map.removeLayer(marker));
        markers = [];

        // Create new markers
        data.forEach(d => {
            const marker = L.marker([d.latitude, d.longitude])
                .bindPopup(`
                    <strong>${d.county}, ${d.state}</strong><br>
                    ${currentPollutant.toUpperCase()}: ${d[currentPollutant]} ${currentPollutant === 'pm25' ? 'µg/m³' : 'ppb'}
                `)
                .addTo(map);
            markers.push(marker);
        });

        // Update legend
        updateLegend(data);

    } catch (error) {
        console.error('Error loading pollution data:', error);
    }
}

function updateLegend(data) {
    const legend = document.getElementById('pollutant-legend');
    const minVal = Math.min(...data.map(d => d[currentPollutant]));
    const maxVal = Math.max(...data.map(d => d[currentPollutant]));

    legend.innerHTML = `
        <h3>${currentPollutant.toUpperCase()} Concentration</h3>
        <div class="color-scale"></div>
        <p>Min: ${minVal.toFixed(1)} ${currentPollutant === 'pm25' ? 'µg/m³' : 'ppb'}</p>
        <p>Max: ${maxVal.toFixed(1)} ${currentPollutant === 'pm25' ? 'µg/m³' : 'ppb'}</p>
    `;
}

document.getElementById('pollutant-select').addEventListener('change', (e) => {
    currentPollutant = e.target.value;
    loadPollutionData();
});

document.getElementById('reset-view').addEventListener('click', () => {
    map.setView([37.0902, -95.7129], 4);
});

// Initialize the map and load data
initMap();
loadPollutionData();
