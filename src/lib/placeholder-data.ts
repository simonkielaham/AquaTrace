

export type Asset = {
  id: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  permanentPoolElevation: number; // in meters
  designElevations: { name: string; elevation: number }[];
  status: "ok" | "warning" | "error";
  imageId: string;
};

export type DataFile = {
  id: string;
  filename: string;
  dataType: 'water-level' | 'precipitation' | 'sensor-suite';
  uploadDate: string;
  startDate: string;
  endDate: string;
  rowCount: number;
  columnMapping: {
    dataType: 'water-level' | 'precipitation' | 'sensor-suite';
    datetimeColumn: string;
    waterLevelColumn?: string;
    precipitationColumn?: string;
    sensorPressureColumn?: string;
    temperatureColumn?: string;
    barometerColumn?: string;
    startRow: number;
  }
};

export type StagedFile = {
  filename: string;
  path: string;
  size: number;
  type: string;
  uploadDate: string;
}

export type DataPoint = {
  timestamp: number;
  waterLevel: number;
};

export type SurveyPoint = {
  id: string;
  assetId: string;
  timestamp: number;
  elevation: number;
  source?: 'manual' | 'tape-down';
  tapeDownMeasurement?: number;
  stillwellTopElevation?: number;
  deploymentId?: string;
};

export type Deployment = {
  id:string;
  assetId: string;
  sensorId: string;
  sensorElevation: number;
  stillwellTop?: number;
  name?: string;
  files?: DataFile[];
};

export type AnalysisResult = {
  id: string;
  assetId: string;
  type: "Blocked Outlet" | "Potential Leak" | "Normal Drainage" | "High Inflow";
  severity: "high" | "medium" | "low" | "info";
  description: string;
  timestamp: string;
};

export type SavedAnalysisData = {
    notes?: string;
    status?: "normal" | "not_normal" | "holding_water" | "leaking";
    analystInitials?: string;
}

export type AnalysisPeriod = {
    id: string;
    assetId: string;
    startDate: number;
    endDate: number;
    totalPrecipitation: number;
    dataPoints: ChartablePoint[];
    analysis?: {
        peakTimestamp?: number;
        peakElevation?: number;
        baselineElevation?: number;
        postEventElevation?: number;
        timeToBaseline?: string;
        drawdownAnalysis?: string;
        estimatedTrueBaseline?: number;
        marginOfError?: number;
        notes?: string;
        status?: "normal" | "not_normal" | "holding_water" | "leaking";
        analystInitials?: string;
    }
}

export type ChartablePoint = {
    timestamp: number;
    waterLevel?: number;
    rawWaterLevel?: number;
    elevation?: number;
    precipitation?: number;
    dailyPrecipitation?: number;
    sensorPressure?: number;
    temperature?: number;
    barometer?: number;
}

export type WeatherSummary = {
  totalPrecipitation: number;
  events: AnalysisPeriod[];
};


// This file now only contains type definitions.
// The actual data is loaded and managed in AssetProvider.
export const analysisResults: AnalysisResult[] = [];
