
export type Asset = {
  id: string;
  name: string;
  location: string;
  permanentPoolElevation: number; // in meters
  designElevations: { year: number; elevation: number }[];
  status: "ok" | "warning" | "error";
  imageId: string;
};

export type DataFile = {
  id: string;
  filename: string;
  uploadDate: string;
  startDate: string;
  endDate: string;
  rowCount: number;
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

export type Deployment = {
  id:string;
  assetId: string;
  sensorId: string;
  sensorElevation: number;
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

export type ActivityLog = {
  id: string;
  timestamp: string;
  action: string;
  status: 'success' | 'failure';
  assetId?: string;
  deploymentId?: string;
  payload: any;
  response: any;
};


// This file now only contains type definitions.
// The actual data is loaded and managed in AssetProvider.
export const analysisResults: AnalysisResult[] = [];

    