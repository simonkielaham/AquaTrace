
import assetsData from '@/../data/assets.json';
import deploymentsData from '@/../data/deployments.json';
import analysisData from '@/../data/analysis-results.json';
import performanceDataJson from '@/../data/performance-data.json';

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
  fileName: string;
  fileCount: number;
  sensorElevation: number;
};

export type DataPoint = {
  time: string; // ISO string
  waterLevel: number; // in meters
  waterElevation: number; // in meters
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

// These are now the initial values which can be updated by server actions
export const assets: Asset[] = assetsData;
export const deployments: Deployment[] = deploymentsData;
export const analysisResults: AnalysisResult[] = analysisData;

// The performance data can be a mix of parsed and unparsed data depending on where it comes from.
// This ensures it is always parsed correctly.
export const performanceData: { [key: string]: DataPoint[] } = {};
for (const key in performanceDataJson) {
    if (Object.prototype.hasOwnProperty.call(performanceDataJson, key)) {
        const value = (performanceDataJson as any)[key];
        if (typeof value === 'string') {
            try {
                performanceData[key] = JSON.parse(value);
            } catch (e) {
                console.error(`Failed to parse performance data for key ${key}:`, e);
                performanceData[key] = [];
            }
        } else {
            performanceData[key] = value;
        }
    }
}
