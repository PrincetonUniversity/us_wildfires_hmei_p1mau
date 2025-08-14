# Frontend Component Documentation

## Overview

The PM₂.₅ Wildfire Impact Map frontend is built with React 18 and uses a component-based architecture. The application provides interactive maps, charts, and controls for visualizing PM₂.₅ wildfire data across US counties, with a focus on public health impacts and policy support.

## Application Structure

```
src/
├── App.js                 # Main application component
├── index.js              # Application entry point
├── components/           # React components
│   ├── Map.js           # Interactive map component
│   ├── Sidebar.js       # Control panel
│   ├── LayerControl.js  # Layer selection
│   ├── LayerTimeControls.js # Time and metric controls
│   ├── Legend.js        # Map legend
│   ├── CountyInfoPanel.js # County information panel
│   ├── CountyBarChart.js # PM₂.₅ time series chart
│   ├── CountyMortalityBarChart.js # Mortality chart
│   ├── CountyDecompositionChart.js # Decomposition chart
│   ├── About.js         # About page
│   ├── Partners.js      # Partners page
│   ├── Methodology.js   # Data & Methodology page
│   └── Navigation.js    # Navigation tabs
├── styles/
│   └── style.css        # Global styles
└── utils/
    ├── api.js           # API utility functions
    ├── aqi.js           # AQI calculation utilities
    └── mapUtils.js      # Map utility functions
```

## State Management

The application uses React hooks for state management with a top-down data flow pattern:

### Global State (App.js)

```javascript
// Layer and metric state
const [activeLayer, setActiveLayer] = useState('average');
const [pm25SubLayer, setPm25SubLayer] = useState('total');
const [mortalitySubMetric, setMortalitySubMetric] = useState('total');

// Time controls
const [timeControls, setTimeControls] = useState({
  timeScale: 'yearly',
  year: 2023,
  month: 1,
  season: 'winter'
});

// County selection and interaction
const [selectedCounty, setSelectedCounty] = useState(null);
const [hoveredCounty, setHoveredCounty] = useState(null);
const [selectedAgeGroups, setSelectedAgeGroups] = useState([]);

// UI state
const [loading, setLoading] = useState(false);
const [mapRefreshKey, setMapRefreshKey] = useState(0);
const [activeTab, setActiveTab] = useState('map');
```

### State Flow

```
User Interaction → Event Handler → State Update → 
Component Re-render → API Call → Data Update → UI Update
```

---

## Component Documentation

### App.js

**Purpose**: Main application component that orchestrates all other components and manages global state.

**Props**: None (root component)

**State Management**:
- Manages all global application state
- Coordinates between map and sidebar components
- Handles data fetching and caching
- Manages tab navigation (map, about, partners, methodology)

**Key Methods**:
```javascript
const handleSetActiveLayer = (layer) => {
  if (PM25_LAYERS.includes(layer)) {
    setActiveLayer(layer);
    setPm25SubLayer('total');
  } else if (HEALTH_LAYERS.includes(layer)) {
    setActiveLayer(layer);
    setPm25SubLayer('');
  } else {
    setActiveLayer(layer);
  }
};

const handleTabChange = (newTab) => {
  setActiveTab(newTab);
};

const handleCountySelect = (county) => {
  if (selectedCounty && county && selectedCounty.fips === county.fips) {
    setSelectedCounty(null); // Deselect if clicking same county
  } else if (lastHoveredCounty && county && lastHoveredCounty.fips === county.fips) {
    setSelectedCounty(lastHoveredCounty);
  } else if (county) {
    setSelectedCounty(county);
  }
};
```

**Tab System**:
- **Map**: Main interactive visualization interface
- **About**: Project overview and key features
- **Partners**: Development team and academic partners
- **Data & Methodology**: Research methodology and data sources

### Map.js

**Purpose**: Interactive choropleth map component using Maplibre GL JS for visualizing PM₂.₅ data across US counties.

**Props**:
```javascript
const Map = ({ 
  stateAbbr, 
  activeLayer, 
  pm25SubLayer, 
  timeControls, 
  onCountySelect, 
  onCountyHover, 
  mapRefreshKey, 
  onMapLoaded, 
  selectedCounty, 
  selectedAgeGroups, 
  sidebarWidth = 400 
}) => {
```

**Key Features**:
- **Dynamic Map Bounds**: Adjusts based on sidebar width for optimal viewing
- **Choropleth Visualization**: Color-coded counties based on selected metrics
- **Interactive Legend**: Context-aware color scales and thresholds
- **County Selection**: Click to select counties for detailed analysis
- **Hover Effects**: Real-time county information on hover

**State Management**:
```javascript
const [choroplethData, setChoroplethData] = useState(null);
const [decompositionPM25Type, setDecompositionPM25Type] = useState("total");
const [mapLoaded, setMapLoaded] = useState(false);
const [loading, setLoading] = useState(true);
```

**Map Controls**:
- **Zoom Controls**: Automatic zoom adjustment based on sidebar width
- **Pan Controls**: Smooth navigation across the United States
- **Layer Switching**: Dynamic data layer updates

**Data Fetching**:
```javascript
const fetchChoroplethData = async () => {
  if (!PM25_LAYERS.includes(activeLayer) && !HEALTH_LAYERS.includes(activeLayer) && !EXCEEDANCE_LAYERS.includes(activeLayer)) return;

  try {
    setLoading(true);
    let endpoint = '/api/counties/choropleth/average';
    let url = '';

    if (PM25_LAYERS.includes(activeLayer)) {
      let params = new URLSearchParams();
      params.append('time_scale', timeScale);
      if (year) params.append('year', year.toString());
      if (timeScale === 'monthly' && month) params.append('month', month.toString());
      if (timeScale === 'seasonal' && season) params.append('season', season);
      params.append('sub_metric', subMetric);
      
      if (metric === 'max') endpoint = '/api/counties/choropleth/max';
      if (metric === 'pop_weighted') endpoint = '/api/counties/choropleth/pop_weighted';
      url = `${API_BASE_URL}${endpoint}?${params}`;
    }
    // ... additional endpoint logic
  } catch (error) {
    console.error('Error fetching choropleth data:', error);
  } finally {
    setLoading(false);
  }
};
```

**Legend System**:
- **Dynamic Color Scales**: Adapts to selected data layer
- **PM₂.₅ Units**: Displays µg/m³ values with proper units
- **Threshold Indicators**: Shows exceedance levels and regulatory standards

### Sidebar.js

**Purpose**: Control panel providing layer selection, time controls, and county information display.

**Props**:
```javascript
const Sidebar = ({
  activeLayer,
  setActiveLayer,
  pm25SubLayer,
  setPm25SubLayer,
  timeControls,
  setTimeControls,
  selectedCounty,
  hoveredCounty,
  loading,
  onClearSelectedCounty,
  selectedAgeGroups,
  setSelectedAgeGroups,
  mortalitySubMetric,
  setMortalitySubMetric
}) => {
```

**Key Features**:
- **Layer Selection**: Switch between PM₂.₅ and health metrics
- **Time Controls**: Yearly, monthly, seasonal, and daily views
- **Age Group Selection**: Multi-select age groups for mortality analysis
- **County Information**: Detailed county data when selected
- **Responsive Design**: Adapts to different screen sizes

**Layer Options**:
```javascript
const PM25_LAYERS = ['average', 'max', 'pop_weighted'];
const HEALTH_LAYERS = ['mortality', 'yll', 'population'];
const EXCEEDANCE_LAYERS = ['exceedance_8', 'exceedance_9'];
```

**Age Group Selection**:
```javascript
const AGE_GROUPS = [
  { value: 1, label: '0-4' },
  { value: 2, label: '5-9' },
  { value: 3, label: '10-14' },
  // ... additional age groups
  { value: 18, label: '85+' }
];
```

### LayerTimeControls.js

**Purpose**: Provides time scale selection and metric controls for different data layers.

**Props**:
```javascript
const LayerTimeControls = ({
  activeLayer,
  setActiveLayer,
  pm25SubLayer,
  setPm25SubLayer,
  timeControls,
  setTimeControls,
  showTimeControls,
  mortalitySubMetric,
  setMortalitySubMetric
}) => {
```

**Time Scale Options**:
- **Yearly**: 2006-2023 annual data
- **Monthly**: Specific month within a year
- **Seasonal**: Winter, spring, summer, fall
- **Daily**: Day-level data for specific periods

**Metric Controls**:
```javascript
const pm25Options = [
  { value: 'average', label: 'Average' },
  { value: 'max', label: 'Max' }
];

const pm25SubOptions = [
  { value: 'total', label: 'Total' },
  { value: 'fire', label: 'Fire' },
  { value: 'nonfire', label: 'Non-fire' }
];

const healthOptions = [
  { value: 'mortality', label: 'Mortality' },
  { value: 'yll', label: 'YLL' },
  { value: 'population', label: 'Population' }
];
```

### CountyInfoPanel.js

**Purpose**: Displays detailed information for selected counties including PM₂.₅ statistics, population data, and health metrics.

**Props**:
```javascript
const CountyInfoPanel = ({ selectedCounty, onClearSelectedCounty }) => {
```

**Information Display**:
- **PM₂.₅ Metrics**: Average, maximum, and population-weighted values
- **Source Attribution**: Fire vs. non-fire PM₂.₅ breakdowns
- **Population Data**: County demographics and age distributions
- **Health Metrics**: Mortality rates and YLL estimates
- **Exceedance Data**: Days exceeding EPA standards

**Data Visualization**:
- **Bar Charts**: Temporal trends in PM₂.₅ levels
- **Mortality Charts**: Health impact visualizations
- **Decomposition Charts**: Factor contribution analysis

### CountyBarChart.js

**Purpose**: Interactive bar chart component for visualizing PM₂.₅ time series data with fire vs. non-fire breakdowns.

**Props**:
```javascript
const CountyBarChart = ({ data, timeScale, zoomed }) => {
```

**Chart Features**:
- **Dynamic Sizing**: Adapts to time scale and data volume
- **Color Coding**: Fire (orange) vs. non-fire (blue) PM₂.₅
- **Interactive Tooltips**: Detailed information on hover
- **Responsive Design**: Optimized for different screen sizes
- **AQI Integration**: Color coding based on air quality levels

**Time Scale Handling**:
```javascript
const formatXAxis = (tickItem, index) => {
  if (timeScale === 'yearly') {
    const year = parseInt(tickItem);
    return year % 2 === 0 ? year : '';
  } else {
    const [month, day] = tickItem.split('/');
    if (chartData.length <= 10) return tickItem;
    if (chartData.length <= 20) return index % 2 === 0 ? tickItem : '';
    if (chartData.length <= 40) return index % 5 === 0 ? tickItem : '';
    return index % 7 === 0 ? tickItem : '';
  }
};
```

### CountyMortalityBarChart.js

**Purpose**: Specialized chart for visualizing mortality and YLL data with age-group specific breakdowns.

**Props**:
```javascript
const CountyMortalityBarChart = ({ data, timeScale = 'yearly', yllMode = false }) => {
```

**Chart Features**:
- **Dual Modes**: Mortality counts or Years of Life Lost (YLL)
- **Age Group Support**: Demographic breakdowns
- **Source Attribution**: Fire vs. non-fire health impacts
- **Statistical Summaries**: Total counts and rates

### CountyDecompositionChart.js

**Purpose**: Visualizes the decomposition of mortality changes into contributing factors.

**Props**:
```javascript
const CountyDecompositionChart = ({ decompositionData }) => {
```

**Decomposition Factors**:
- **Population Growth**: Impact of population size changes
- **Population Ageing**: Effect of demographic shifts
- **Baseline Mortality Change**: Health improvements over time
- **Exposure Change**: Air pollution level variations
- **Total Change**: Overall mortality trend

**Chart Features**:
- **Factor Breakdown**: Visual representation of contributions
- **Percentage Calculations**: Relative importance of each factor
- **Interactive Tooltips**: Detailed explanations
- **Color Coding**: Distinct colors for each factor

### About.js

**Purpose**: About page providing project overview, key features, and mission statement.

**Content Sections**:
- **Project Overview**: Description of the PM₂.₅ Wildfire Impact Map
- **Key Features**: Comprehensive list of platform capabilities
- **Mission**: Goals and objectives of the research platform

**Key Features Listed**:
1. Interactive Maps with choropleth visualization
2. Multi-Layer Analysis for different data types
3. Source Attribution for fire vs. non-fire PM₂.₅
4. Time-Scale Analysis across multiple temporal views
5. County Profiles with detailed local information
6. Interactive Charts for temporal trends
7. Decomposition Analysis for mortality factors
8. Mortality Analysis with age-group specificity
9. Exceedance Tracking for regulatory standards
10. Population Weighting for exposure calculations
11. Dynamic Legend with context-aware scales
12. Hover & Click Interactions for user engagement
13. Responsive Design for multiple devices

### Partners.js

**Purpose**: Displays information about the development team and academic partners.

**Content Sections**:
- **Development Team**: Project contributors and their roles
- **Academic Partners**: Research institutions and their contributions

**Development Team Members**:
1. **Hassan Khan**: Lead Developer & Project Manager (Princeton University, Computer Science, Class of 2027)
2. **Yuanyu Xie**: Project Supervisor (Princeton University, C-PREE Associate Research Scholar)
3. **Denise Mauzerall**: Project Supervisor (Princeton University, Professor of Civil and Environmental Engineering and Public and International Affairs)
4. **Thomas Zhang**: Contributing Developer (Princeton University, Electrical and Computer Engineering, Class of 2028)

**Academic Partners**:
1. **High Meadows Environmental Institute (HMEI)**: Research Institution & Project Host
2. **Center for Policy Research on Energy and the Environment (C-PREE)**: Policy Research & Technical Guidance

### Methodology.js

**Purpose**: Comprehensive documentation of data sources, methodology, and research foundation.

**Content Sections**:
- **Quick Overview**: Executive summary for general public
- **Data Sources**: Detailed information about all data inputs
- **Methodology**: Analytical approaches and methods
- **Literature**: Research papers and references

**Data Sources**:
1. Surface Smoke Observations (2000–2023)
2. Satellite Smoke Observations (2006–2023)
3. PM₂.₅ and Organic Carbon Data (2006–2023)
4. Model Simulations (GFDL AM4VR, 2021–2023)
5. Baseline Mortality Rate (2000–2019)
6. Life Expectancy Data
7. Population Data (2006–2023)
8. PM Attribution Bins

**Methodology**:
1. **PM₂.₅ Methods**: Combined approach using multiple data sources
2. **Health Impact Calculations**: Excess mortality and YLL estimation
3. **Decomposition Analysis**: Factor contribution breakdown
4. **Statistical Models**: CRFs and risk ratio models

**Technical Details**:
- Collapsible sections for researchers
- Mathematical formulas and equations
- Statistical model specifications
- Research paper references

### Navigation.js

**Purpose**: Navigation component providing tab-based navigation between different sections.

**Props**:
```javascript
const Navigation = ({ activeTab, onTabChange }) => {
```

**Navigation Tabs**:
- **Map**: Main visualization interface
- **About**: Project information
- **Partners**: Team and institutional information
- **Data & Methodology**: Research documentation

**Tab Management**:
```javascript
const handleChange = (event, newValue) => {
  onTabChange(newValue);
};
```

---

## Data Flow and API Integration

### API Calls

**Choropleth Data**:
```javascript
const response = await fetch(`/api/counties/choropleth/${activeLayer}?${params}`);
const data = await response.json();
setChoroplethData(data);
```

**Time Series Data**:
```javascript
const response = await fetch(`/api/pm25/bar_chart/${fips}?${params}`);
const data = await response.json();
```

**Mortality Data**:
```javascript
const response = await fetch(`/api/excess_mortality?fips=${fips}`);
const data = await response.json();
```

**Decomposition Data**:
```javascript
const response = await fetch(`/api/counties/decomp/${fips}?pm25_type=${pm25Type}`);
const data = await response.json();
```

### Data Processing

**Choropleth Data**:
- GeoJSON feature collection processing
- Dynamic color scale calculation
- Legend generation and updates

**Time Series Data**:
- Temporal data aggregation
- Chart data formatting
- Interactive tooltip generation

**County Selection**:
- Geometry highlighting
- Information panel updates
- Chart data fetching

---

## Styling and UI Components

### Material-UI Integration

**Component Library**:
- Typography, Paper, Container for layout
- Grid system for responsive design
- Card components for information display
- Accordion for collapsible content
- Button and form controls for interactions

**Theme Customization**:
```javascript
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
  typography: {
    fontFamily: 'Roboto, sans-serif',
  },
});
```

### Responsive Design

**Breakpoint System**:
- xs: 0px and up
- sm: 600px and up
- md: 900px and up
- lg: 1200px and up
- xl: 1536px and up

**Grid Layout**:
```javascript
<Grid container spacing={3}>
  <Grid item xs={12} md={6}>
    {/* Content */}
  </Grid>
</Grid>
```

### CSS Customization

**Global Styles**:
- Custom color schemes
- Typography hierarchy
- Spacing and layout rules
- Interactive element styling

**Component-Specific Styles**:
- Map container styling
- Chart customization
- Panel layouts
- Navigation styling

---

## Performance Optimization

### React Optimization

**Memoization**:
```javascript
const CountyBarChart = React.memo(({ data, timeScale, zoomed }) => {
  // Component implementation
});
```

**State Updates**:
- Efficient state management
- Minimal re-renders
- Optimized data fetching

### Data Handling

**Lazy Loading**:
- County data loaded on demand
- Chart data fetched when needed
- Progressive data loading

**Caching**:
- Choropleth data caching
- County information caching
- Chart data persistence

---

## Error Handling and User Experience

### Error States

**Loading States**:
- Spinner indicators
- Skeleton loaders
- Progress bars

**Error Boundaries**:
- Graceful error handling
- User-friendly error messages
- Fallback UI components

### User Feedback

**Interactive Elements**:
- Hover effects
- Click animations
- Visual feedback

**Accessibility**:
- ARIA labels
- Keyboard navigation
- Screen reader support

---

## Development and Testing

### Development Setup

**Environment Configuration**:
```bash
npm install
npm start
```

**Code Quality**:
- ESLint configuration
- Prettier formatting
- TypeScript support (optional)

### Testing Strategy

**Component Testing**:
- Unit tests for individual components
- Integration tests for component interactions
- End-to-end testing for user workflows

**Data Testing**:
- API response validation
- Chart data accuracy
- Map interaction testing

---

## Future Enhancements

### Planned Features

**Additional Visualizations**:
- Heat maps for temporal patterns
- 3D visualizations for complex data
- Animated transitions for time series

**Enhanced Interactivity**:
- Advanced filtering options
- Custom chart configurations
- Data export functionality

**Performance Improvements**:
- WebGL rendering for large datasets
- Virtual scrolling for long lists
- Advanced caching strategies

---

This documentation provides a comprehensive overview of the frontend component architecture, state management, and user interface design for the PM₂.₅ Wildfire Impact Map. For specific implementation details, refer to the inline comments and component source code. 