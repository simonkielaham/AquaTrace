export type Asset = {
  id: string;
  name: string;
  location: string;
  permanentPoolElevation: number; // in meters
  designElevations: { year: number; elevation: number }[];
  status: "ok" | "warning" | "error";
  imageId: string;
};

export type Deployment = {
  id:string;
  assetId: string;
  sensorId: string;
  startDate: string;
  endDate: string | null;
  fileCount: number;
};

export type DataPoint = {
  time: string; // ISO string
  waterLevel: number; // in meters
  precipitation: number; // in mm, using number to allow 0
};

export type AnalysisResult = {
  id: string;
  assetId: string;
  type: "Blocked Outlet" | "Potential Leak" | "Normal Drainage" | "High Inflow";
  severity: "high" | "medium" | "low" | "info";
  description: string;
  timestamp: string;
};

export const assets: Asset[] = [
  {
    id: "asset-01",
    name: "Northwood Pond",
    location: "Springfield, ON",
    permanentPoolElevation: 10.5,
    designElevations: [
      { year: 2, elevation: 11.0 },
      { year: 5, elevation: 11.5 },
      { year: 10, elevation: 12.0 },
      { year: 100, elevation: 12.8 },
    ],
    status: "warning",
    imageId: "pond"
  },
  {
    id: "asset-02",
    name: "Oakridge Basin",
    location: "Shelbyville, ON",
    permanentPoolElevation: 22.0,
    designElevations: [
      { year: 2, elevation: 22.4 },
      { year: 5, elevation: 22.9 },
      { year: 10, elevation: 23.3 },
      { year: 100, elevation: 24.1 },
    ],
    status: "ok",
    imageId: "basin"
  },
  {
    id: "asset-03",
    name: "Maple Creek SWMF",
    location: "Capital City, ON",
    permanentPoolElevation: 5.2,
    designElevations: [
      { year: 2, elevation: 5.8 },
      { year: 5, elevation: 6.3 },
      { year: 10, elevation: 6.7 },
      { year: 100, elevation: 7.5 },
    ],
    status: "error",
    imageId: "creek"
  },
];

export const deployments: Deployment[] = [
    { id: 'dep-01', assetId: 'asset-01', sensorId: 'SN-A1B2', startDate: '2023-05-01', endDate: '2023-08-31', fileCount: 4 },
    { id: 'dep-02', assetId: 'asset-01', sensorId: 'SN-C3D4', startDate: '2023-09-01', endDate: null, fileCount: 2 },
    { id: 'dep-03', assetId: 'asset-02', sensorId: 'SN-E5F6', startDate: '2023-06-15', endDate: null, fileCount: 3 },
    { id: 'dep-04', assetId: 'asset-03', sensorId: 'SN-G7H8', startDate: '2023-04-20', endDate: '2023-07-20', fileCount: 3 },
    { id: 'dep-05', assetId: 'asset-03', sensorId: 'SN-I9J0', startDate: '2023-07-21', endDate: null, fileCount: 5 },
];

export const analysisResults: AnalysisResult[] = [
    { id: 'res-01', assetId: 'asset-01', type: 'Blocked Outlet', severity: 'medium', description: 'Water level failed to return to permanent pool within 48 hours after rain event.', timestamp: '2023-08-17T14:00:00Z' },
    { id: 'res-02', assetId: 'asset-01', type: 'Normal Drainage', severity: 'info', description: 'Asset drained as expected after minor precipitation.', timestamp: '2023-08-22T08:00:00Z' },
    { id: 'res-03', assetId: 'asset-02', type: 'Normal Drainage', severity: 'info', description: 'Performance is nominal across all observed events.', timestamp: '2023-08-25T11:00:00Z' },
    { id: 'res-04', assetId: 'asset-03', type: 'Potential Leak', severity: 'high', description: 'Consistent water level drop below permanent pool during dry periods.', timestamp: '2023-07-10T18:00:00Z' },
    { id: 'res-05', assetId: 'asset-03', type: 'High Inflow', severity: 'low', description: 'Unusually rapid water level increase with minimal rain.', timestamp: '2023-08-05T09:00:00Z' },
];

const generateData = (base: number, days: number): DataPoint[] => {
    const data: DataPoint[] = [];
    let currentDate = new Date('2023-08-01T00:00:00Z');
    let currentLevel = base;

    for (let i = 0; i < days * 24; i++) { // hourly data for `days` days
        const precipitation = Math.random() < 0.1 ? Math.random() * 20 : 0;
        if(precipitation > 0) {
            currentLevel += precipitation / 100 * (2 + Math.random());
        } else {
            currentLevel -= 0.005 * (1 + Math.random()); // Evaporation/leakage
        }
        
        if (currentLevel < base - 0.1) {
            currentLevel = base - 0.1 + Math.random() * 0.05;
        }

        data.push({
            time: currentDate.toISOString(),
            waterLevel: parseFloat(currentLevel.toFixed(2)),
            precipitation: parseFloat(precipitation.toFixed(2)),
        });

        currentDate.setHours(currentDate.getHours() + 1);
    }
    return data;
};

const generateBlockedData = (base: number, days: number): DataPoint[] => {
    const data = generateData(base, days);
    const rainEventIndex = data.findIndex(d => d.precipitation > 10);
    if(rainEventIndex > -1) {
        for(let i = rainEventIndex + 1; i < data.length; i++) {
            data[i].waterLevel += 0.4 * (1 - (i - rainEventIndex) / (data.length - rainEventIndex)); // Stays high
        }
    }
    return data;
}

const generateLeakyData = (base: number, days: number): DataPoint[] => {
    const data = generateData(base, days);
    for(let i = 0; i < data.length; i++) {
        if (data[i].precipitation === 0) {
            data[i].waterLevel -= 0.05; // Extra leak
        }
    }
    return data;
}

export const performanceData: { [key: string]: DataPoint[] } = {
    "asset-01": generateBlockedData(10.5, 30),
    "asset-02": generateData(22.0, 30),
    "asset-03": generateLeakyData(5.2, 30),
};
