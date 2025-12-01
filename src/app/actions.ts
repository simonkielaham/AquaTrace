

'use server';

import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { Asset, Deployment, ActivityLog, DataFile, StagedFile, SurveyPoint, ChartablePoint, AnalysisPeriod, WeatherSummary, SavedAnalysisData, OverallAnalysisData, OperationalAction, AssetStatus } from '@/lib/placeholder-data';
import Papa from 'papaparse';
import { format, formatDistance, startOfDay } from 'date-fns';
import { getWeatherData } from '../../sourceexamples/weather-service';
import { runDiagnostics } from '@/lib/diagnostics';


// Define paths to data files
const dataDir = path.join(process.cwd(), 'data');
const cacheDir = path.join(dataDir, 'cache');
const assetsFilePath = path.join(dataDir, 'assets.json');
const deploymentsFilePath = path.join(dataDir, 'deployments.json');
const activityLogFilePath = path.join(dataDir, 'activity-log.json');
const stagedDir = path.join(process.cwd(), 'staged');
const processedDir = path.join(dataDir, 'processed');
const sourcefileDir = path.join(dataDir, 'sourcefiles');


// Define the schema for the form data
const assetFormSchema = z.object({
  name: z.string().min(2),
  location: z.string().min(2),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  permanentPoolElevation: z.coerce.number().min(0),
  designElevations: z.array(z.object({
    name: z.string().min(1),
    elevation: z.coerce.number()
  })),
  imageId: z.string().optional(),
});

const editAssetFormSchema = z.object({
  name: z.string().min(2),
  location: z.string().min(2),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  permanentPoolElevation: z.coerce.number().min(0),
  designElevations: z.array(z.object({
    name: z.string().min(1),
    elevation: z.coerce.number()
  })),
  imageId: z.string().optional(),
});

const deploymentFormSchema = z.object({
  sensorId: z.string().min(1),
  sensorElevation: z.coerce.number(),
  stillwellTop: z.coerce.number().optional(),
  name: z.string().optional(),
  designDrawdown: z.coerce.number().optional(),
});


const editDeploymentSchema = z.object({
  name: z.string().optional(),
  sensorId: z.string().min(1),
  sensorElevation: z.coerce.number(),
  stillwellTop: z.coerce.number().optional(),
  designDrawdown: z.coerce.number().optional(),
});

const surveyPointSchema = z.object({
  timestamp: z.string().datetime(),
  elevation: z.coerce.number(),
  source: z.enum(['manual', 'tape-down']).default('manual'),
  tapeDownMeasurement: z.coerce.number().optional(),
  stillwellTopElevation: z.coerce.number().optional(),
  deploymentId: z.string(),
});

const operationalActionSchema = z.object({
    timestamp: z.string().datetime(),
    action: z.string().min(3, "Action description is required."),
    deploymentId: z.string(),
});

const saveAnalysisSchema = z.object({
  eventId: z.string(),
  notes: z.string().optional(),
  status: z.enum(["normal" , "not_normal" , "holding_water" , "leaking"]).optional(),
  analystInitials: z.string().min(1, "Analyst initials are required."),
  disregarded: z.boolean().optional(),
});

const saveDeploymentAnalysisSchema = z.object({
    deploymentId: z.string(),
    permanentPoolPerformance: z.enum(['sits_at_pool', 'sits_above_pool', 'sits_below_pool', 'fluctuates']).optional(),
    estimatedControlElevation: z.coerce.number().optional(),
    rainResponse: z.enum(['as_expected', 'slow_response', 'fast_response', 'no_response']).optional(),
    furtherInvestigation: z.enum(['not_needed', 'recommended', 'required']).optional(),
    summary: z.string().optional(),
    analystInitials: z.string().min(1, "Analyst initials are required."),
    status: z.enum(["operating_as_expected", "minor_concerns", "critical_concerns"]),
});

// Zod schema definitions
const baseDatafileSchema = z.object({
    dataType: z.enum(['water-level', 'precipitation', 'sensor-suite']),
    datetimeColumn: z.string(),
    waterLevelColumn: z.string().optional(),
    precipitationColumn: z.string().optional(),
    sensorPressureColumn: z.string().optional(),
    temperatureColumn: z.string().optional(),
    barometerColumn: z.string().optional(),
    startRow: z.coerce.number().min(1),
});

const assignDatafileSchema = baseDatafileSchema.extend({
  deploymentId: z.string(),
  assetId: z.string(),
  filename: z.string(),
});

const reassignDatafileSchema = baseDatafileSchema.extend({
  deploymentId: z.string(),
  fileId: z.string(),
  filename: z.string(),
});


// Helper function to read and parse a JSON file
async function readJsonFile<T>(filePath: string): Promise<T> {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const fileContent = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      const baseName = path.basename(filePath);
      if (['assets.json', 'deployments.json', 'activity-log.json'].includes(baseName)) {
          return [] as T;
      }
      if (['deployment-analysis.json', 'diagnostics.json', 'data.json', 'events.json', 'survey-points.json', 'operational-actions.json'].includes(baseName)) {
          const emptyState: Record<string, any> = {
            'deployment-analysis.json': {},
            'diagnostics.json': {},
            'data.json': [],
            'events.json': { totalPrecipitation: 0, events: [] },
            'survey-points.json': [],
            'operational-actions.json': [],
          }
          if(emptyState[baseName]) return emptyState[baseName] as T;

          // Fallback for other JSON files.
          const arrayFiles = ['assets.json', 'deployments.json', 'activity-log.json'];
          if (arrayFiles.includes(path.basename(filePath))) {
              return [] as T;
          }
          return {} as T;
      }
      return {} as T;
    }
    console.error(`Error reading ${filePath}:`, error);
    throw new Error(`Could not read data file: ${path.basename(filePath)}`);
  }
}


// Helper function to write to a JSON file
async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
     console.error(`Error writing ${filePath}:`, error);
    throw new Error(`Could not write data file: ${path.basename(filePath)}`);
  }
}

// Logging helper
async function writeLog(logEntry: Omit<ActivityLog, 'id' | 'timestamp'>) {
  try {
    const logs = await readJsonFile<ActivityLog[]>(activityLogFilePath);
    const newLog: ActivityLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...logEntry,
    };
    logs.unshift(newLog); // Add to the beginning for chronological order
    await writeJsonFile(activityLogFilePath, logs);
  } catch (error) {
    console.error("Failed to write to activity log:", error);
  }
}


// == File System Actions ==
export async function checkFileExists(relativePath: string): Promise<boolean> {
  const fullPath = path.join(process.cwd(), relativePath);
  try {
    await fs.access(fullPath);
    return true;
  } catch {
    return false;
  }
}


// == Asset Actions ==

export async function createAsset(data: any) {
  const logPayload = { ...data, imageId: data.imageId ? '...<base64>...' : undefined };
  const validatedFields = assetFormSchema.safeParse(data);

  if (!validatedFields.success) {
    const response = { errors: validatedFields.error.flatten().fieldErrors, message: "Validation failed." };
    await writeLog({ action: 'createAsset', status: 'failure', payload: logPayload, response });
    return response;
  }
  const { name, location, latitude, longitude, permanentPoolElevation, designElevations, imageId } = validatedFields.data;
  
  try {
    const assets = await readJsonFile<Asset[]>(assetsFilePath);
    const newAsset: Asset = {
      id: `asset-${Date.now()}`,
      name,
      location,
      latitude,
      longitude,
      permanentPoolElevation,
      designElevations,
      imageId: imageId || '',
      status: "unknown"
    };

    assets.push(newAsset);
    await writeJsonFile(assetsFilePath, assets);

    revalidatePath('/asset-management');
    revalidatePath('/');
    
    const response = { message: 'Asset created successfully', newAsset };
    await writeLog({ action: 'createAsset', status: 'success', assetId: newAsset.id, payload: logPayload, response });
    return response;

  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    const response = { message: `Error: ${message}` };
    await writeLog({ action: 'createAsset', status: 'failure', payload: logPayload, response });
    return response;
  }
}

export async function updateAsset(assetId: string, data: any) {
  const logPayload = { ...data, imageId: data.imageId ? '...<base64>...' : undefined };
  const validatedFields = editAssetFormSchema.safeParse(data);

  if (!validatedFields.success) {
    const response = { errors: validatedFields.error.flatten().fieldErrors, message: 'Validation failed.' };
    await writeLog({ action: 'updateAsset', status: 'failure', assetId, payload: logPayload, response });
    return response;
  }

  const { name, location, latitude, longitude, permanentPoolElevation, designElevations, imageId } = validatedFields.data;

  try {
    let assets = await readJsonFile<Asset[]>(assetsFilePath);
    const assetIndex = assets.findIndex(a => a.id === assetId);

    if (assetIndex === -1) throw new Error("Asset not found.");

    const updatedAsset = {
      ...assets[assetIndex],
      name,
      location,
      latitude,
      longitude,
      permanentPoolElevation,
      designElevations,
      imageId: imageId || '',
    };
    assets[assetIndex] = updatedAsset;
    await writeJsonFile(assetsFilePath, assets);
    
    revalidatePath('/');
    revalidatePath('/asset-management');
    
    const response = { message: 'Asset updated successfully', updatedAsset };
    await writeLog({ action: 'updateAsset', status: 'success', assetId, payload: logPayload, response });
    return response;

  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    const response = { message: `Error: ${message}` };
    await writeLog({ action: 'updateAsset', status: 'failure', assetId, payload: logPayload, response });
    return response;
  }
}

export async function deleteAsset(assetId: string) {
  const logPayload = { assetId };
  try {
    const assets = await readJsonFile<Asset[]>(assetsFilePath);
    const updatedAssets = assets.filter(a => a.id !== assetId);
    await writeJsonFile(assetsFilePath, updatedAssets);

    const deployments = await readJsonFile<Deployment[]>(deploymentsFilePath);
    const updatedDeployments = deployments.filter(d => d.assetId !== assetId);
    await writeJsonFile(deploymentsFilePath, updatedDeployments);

    revalidatePath('/');
    revalidatePath('/asset-management');

    const response = { message: `Asset ${assetId} deleted.` };
    await writeLog({ action: 'deleteAsset', status: 'success', assetId, payload: logPayload, response });
    return response;

  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    const response = { message: `Error: ${message}` };
    await writeLog({ action: 'deleteAsset', status: 'failure', assetId, payload: logPayload, response });
    return response;
  }
}

// == Deployment Actions ==

export async function createDeployment(assetId: string, data: any) {
  const logPayload = { assetId, ...data };
  const validatedFields = deploymentFormSchema.safeParse(data);
  if (!validatedFields.success) {
    const response = { errors: validatedFields.error.flatten().fieldErrors, message: "Validation failed." };
    await writeLog({ action: 'createDeployment', status: 'failure', assetId, payload: logPayload, response });
    return response;
  }
  
  const { sensorId, sensorElevation, stillwellTop, name, designDrawdown } = validatedFields.data;

  try {
    const deployments = await readJsonFile<Deployment[]>(deploymentsFilePath);
    const newDeployment: Deployment = {
      id: `dep-${Date.now()}`,
      assetId,
      sensorId,
      sensorElevation,
      stillwellTop: stillwellTop,
      name: name || `Deployment - ${format(new Date(), 'PP')}`,
      designDrawdown: designDrawdown,
      files: [],
    };
    
    deployments.push(newDeployment);
    await writeJsonFile(deploymentsFilePath, deployments);

    revalidatePath('/');
    const response = { message: 'Deployment created successfully', newDeployment };
    await writeLog({ action: 'createDeployment', status: 'success', assetId, deploymentId: newDeployment.id, payload: logPayload, response });
    return response;

  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    const response = { message: `Error: ${message}` };
    await writeLog({ action: 'createDeployment', status: 'failure', assetId, payload: logPayload, response });
    return response;
  }
}


export async function updateDeployment(deploymentId: string, assetId: string, data: any) {
  const logPayload = { deploymentId, assetId, ...data };
  const validatedFields = editDeploymentSchema.safeParse(data);
  if (!validatedFields.success) {
    const response = { errors: validatedFields.error.flatten().fieldErrors, message: 'Validation failed.' };
    await writeLog({ action: 'updateDeployment', status: 'failure', assetId, deploymentId, payload: logPayload, response });
    return response;
  }

  const { sensorId, sensorElevation, stillwellTop, name, designDrawdown } = validatedFields.data;
  
  try {
    const deployments = await readJsonFile<Deployment[]>(deploymentsFilePath);
    const deploymentIndex = deployments.findIndex(d => d.id === deploymentId);

    if (deploymentIndex === -1) {
      throw new Error("Deployment not found");
    }

    const updatedDeployment = {
      ...deployments[deploymentIndex],
      sensorId,
      sensorElevation,
      stillwellTop: stillwellTop,
      name,
      designDrawdown: designDrawdown
    };
    deployments[deploymentIndex] = updatedDeployment;
    await writeJsonFile(deploymentsFilePath, deployments);

    // After updating a deployment, we need to reprocess its data
    await processAndAnalyzeDeployment(deploymentId);

    revalidatePath('/');
    const response = { message: 'Deployment updated successfully', updatedDeployment };
    await writeLog({ action: 'updateDeployment', status: 'success', assetId, deploymentId, payload: logPayload, response });
    return response;

  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    const response = { message: `Error: ${message}` };
    await writeLog({ action: 'updateDeployment', status: 'failure', assetId, deploymentId, payload: logPayload, response });
    return response;
  }
}


// == Manual Survey Point Actions ==

export async function addSurveyPoint(data: any) {
  const logPayload = { data };
  const validatedFields = surveyPointSchema.safeParse(data);

  if (!validatedFields.success) {
    const response = { errors: validatedFields.error.flatten().fieldErrors, message: 'Validation failed.' };
    await writeLog({ action: 'addSurveyPoint', status: 'failure', payload: logPayload, response });
    return response;
  }
  const { timestamp, elevation, source, tapeDownMeasurement, stillwellTopElevation, deploymentId } = validatedFields.data;

  try {
    const deployments = await readJsonFile<Deployment[]>(deploymentsFilePath);
    const deployment = deployments.find(d => d.id === deploymentId);
    if (!deployment) throw new Error("Deployment not found");
    const assetId = deployment.assetId;

    const surveyPointsFilePath = path.join(processedDir, deploymentId, 'survey-points.json');
    const surveyPoints = await readJsonFile<SurveyPoint[]>(surveyPointsFilePath);
    
    const finalTimestamp = new Date(timestamp).getTime();
    
    const newPoint: SurveyPoint = {
      id: `survey-${Date.now()}`,
      assetId,
      deploymentId,
      timestamp: finalTimestamp,
      elevation: parseFloat(elevation.toString()),
      source,
      tapeDownMeasurement,
      stillwellTopElevation,
    };
    
    surveyPoints.push(newPoint);
    await writeJsonFile(surveyPointsFilePath, surveyPoints);

    revalidatePath('/');
    
    const response = { message: 'Survey point added successfully', newPoint };
    await writeLog({ action: 'addSurveyPoint', status: 'success', assetId, deploymentId, payload: logPayload, response });
    return response;

  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    const response = { message: `Error: ${message}` };
    await writeLog({ action: 'addSurveyPoint', status: 'failure', payload: logPayload, response });
    return response;
  }
}

export async function getSurveyPoints(deploymentId: string): Promise<SurveyPoint[]> {
  try {
    const surveyPointsFilePath = path.join(processedDir, deploymentId, 'survey-points.json');
    const allPoints = await readJsonFile<SurveyPoint[]>(surveyPointsFilePath);
    return allPoints.sort((a,b) => a.timestamp - b.timestamp);
  } catch (error) {
    console.error(`Failed to get survey points for deployment ${deploymentId}:`, error);
    return [];
  }
}

export async function deleteSurveyPoint(deploymentId: string, pointId: string) {
    const logPayload = { deploymentId, pointId };
    try {
        const surveyPointsFilePath = path.join(processedDir, deploymentId, 'survey-points.json');
        let points = await readJsonFile<SurveyPoint[]>(surveyPointsFilePath);
        const pointToDelete = points.find(p => p.id === pointId);
        
        if (!pointToDelete) {
             const response = { message: `Error: Survey point with ID ${pointId} not found.` };
             await writeLog({ action: 'deleteSurveyPoint', status: 'failure', payload: logPayload, response });
             return response;
        }

        const updatedPoints = points.filter(p => p.id !== pointId);
        await writeJsonFile(surveyPointsFilePath, updatedPoints);

        revalidatePath('/');

        const response = { message: 'Survey point deleted successfully.' };
        await writeLog({ action: 'deleteSurveyPoint', status: 'success', assetId: pointToDelete.assetId, deploymentId, payload: logPayload, response });
        return response;
    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        const response = { message: `Error: ${message}` };
        await writeLog({ action: 'deleteSurveyPoint', status: 'failure', payload: logPayload, response });
        return response;
    }
}


// == Operational Action Actions ==

export async function addOperationalAction(data: any) {
  const logPayload = { data };
  const validatedFields = operationalActionSchema.safeParse(data);

  if (!validatedFields.success) {
    const response = { errors: validatedFields.error.flatten().fieldErrors, message: 'Validation failed.' };
    await writeLog({ action: 'addOperationalAction', status: 'failure', payload: logPayload, response });
    return response;
  }
  const { timestamp, action, deploymentId } = validatedFields.data;

  try {
    const deployments = await readJsonFile<Deployment[]>(deploymentsFilePath);
    const deployment = deployments.find(d => d.id === deploymentId);
    if (!deployment) throw new Error("Deployment not found");
    const assetId = deployment.assetId;

    const operationalActionsFilePath = path.join(processedDir, deploymentId, 'operational-actions.json');
    const actions = await readJsonFile<OperationalAction[]>(operationalActionsFilePath);
    
    const finalTimestamp = new Date(timestamp).getTime();
    
    const newAction: OperationalAction = {
      id: `op-${Date.now()}`,
      assetId,
      deploymentId,
      timestamp: finalTimestamp,
      action
    };
    
    actions.push(newAction);
    await writeJsonFile(operationalActionsFilePath, actions);

    revalidatePath('/');
    
    const response = { message: 'Operational action logged successfully', newAction };
    await writeLog({ action: 'addOperationalAction', status: 'success', assetId, deploymentId, payload: logPayload, response });
    return response;

  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    const response = { message: `Error: ${message}` };
    await writeLog({ action: 'addOperationalAction', status: 'failure', payload: logPayload, response });
    return response;
  }
}

export async function getOperationalActions(deploymentId: string): Promise<OperationalAction[]> {
  try {
    const operationalActionsFilePath = path.join(processedDir, deploymentId, 'operational-actions.json');
    const allActions = await readJsonFile<OperationalAction[]>(operationalActionsFilePath);
    return allActions.sort((a,b) => a.timestamp - b.timestamp);
  } catch (error) {
    console.error(`Failed to get operational actions for deployment ${deploymentId}:`, error);
    return [];
  }
}

export async function deleteOperationalAction(deploymentId: string, actionId: string) {
    const logPayload = { deploymentId, actionId };
    try {
        const operationalActionsFilePath = path.join(processedDir, deploymentId, 'operational-actions.json');
        let actions = await readJsonFile<OperationalAction[]>(operationalActionsFilePath);
        const actionToDelete = actions.find(a => a.id === actionId);

        if (!actionToDelete) {
             const response = { message: `Error: Action with ID ${actionId} not found.` };
             await writeLog({ action: 'deleteOperationalAction', status: 'failure', payload: logPayload, response });
             return response;
        }

        const updatedActions = actions.filter(a => a.id !== actionId);
        await writeJsonFile(operationalActionsFilePath, updatedActions);

        revalidatePath('/');
        const response = { message: 'Operational action deleted successfully.' };
        await writeLog({ action: 'deleteOperationalAction', status: 'success', deploymentId, payload: logPayload, response });
        return response;
    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        const response = { message: `Error: ${message}` };
        await writeLog({ action: 'deleteOperationalAction', status: 'failure', payload: logPayload, response });
        return response;
    }
}
    
export async function assignDatafile(formData: FormData) {
  const rawData = Object.fromEntries(formData);
  const logPayload = { ...rawData };
  delete logPayload.file;
  
  // Clean up "none" values from optional selects before validation
  Object.keys(rawData).forEach(key => {
    if (rawData[key] === 'none') {
        rawData[key] = undefined;
    }
  });

  const validatedFields = assignDatafileSchema.safeParse(rawData);
  if (!validatedFields.success) {
    const response = { errors: validatedFields.error.flatten().fieldErrors, message: "Validation failed." };
    await writeLog({ action: 'assignDatafile', status: 'failure', payload: logPayload, response });
    return response;
  }
  
  const { deploymentId, assetId, filename, ...columnMapping } = validatedFields.data;

  try {
    // 1. Move file from staged to sourcefiles
    const stagedPath = path.join(stagedDir, filename);
    const deployments = await readJsonFile<Deployment[]>(deploymentsFilePath);
    const deployment = deployments.find(d => d.id === deploymentId);
    if (!deployment) throw new Error("Deployment not found.");

    const newFileId = `file-${Date.now()}`;
    const sourcePath = path.join(sourcefileDir, `${newFileId}.csv`);
    await fs.rename(stagedPath, sourcePath);

    // 2. Read file content for processing
    const fileContent = await fs.readFile(sourcePath, 'utf-8');

    // 3. Process the file
    const parseResult = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    });
    
    if (parseResult.errors.length > 0) {
      throw new Error(`CSV parsing error: ${parseResult.errors.map(e => e.message).join(', ')}`);
    }

    const dataPoints = (parseResult.data as any[]).slice(columnMapping.startRow - 1);

    if (dataPoints.length === 0) {
      throw new Error("No data points found in the file after the specified start row.");
    }
    
    // Create new DataFile object
    const fileStartDate = (dataPoints[0] as any)[columnMapping.datetimeColumn];
    const fileEndDate = (dataPoints[dataPoints.length - 1] as any)[columnMapping.datetimeColumn];
    
    const newFile: DataFile = {
      id: newFileId,
      filename: filename,
      dataType: columnMapping.dataType,
      uploadDate: new Date().toISOString(),
      startDate: new Date(fileStartDate).toISOString(),
      endDate: new Date(fileEndDate).toISOString(),
      rowCount: dataPoints.length,
      columnMapping: columnMapping,
    };
    
    // 4. Update deployments.json
    const updatedDeployments = deployments.map(d => {
      if (d.id === deploymentId) {
        const files = d.files || [];
        files.push(newFile);
        return { ...d, files };
      }
      return d;
    });
    await writeJsonFile(deploymentsFilePath, updatedDeployments);

    // 5. Trigger full data re-processing for the deployment
    await processAndAnalyzeDeployment(deploymentId);

    revalidatePath('/');
    const response = { message: 'Datafile assigned and processed successfully.', newFile };
    await writeLog({ action: 'assignDatafile', status: 'success', assetId, deploymentId, payload: logPayload, response });
    return response;

  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    const response = { message: `Error: ${message}` };
    await writeLog({ action: 'assignDatafile', status: 'failure', assetId, deploymentId, payload: logPayload, response });
    return response;
  }
}

export async function downloadLogs(assetId: string) {
  try {
    const allLogs = await readJsonFile<ActivityLog[]>(activityLogFilePath);
    const assetLogs = allLogs.filter(log => log.assetId === assetId);
    
    const logString = assetLogs.map(log => {
      let entry = `[${new Date(log.timestamp).toLocaleString()}] [${log.action}] [${log.status.toUpperCase()}]`;
      if (log.assetId) entry += ` | Asset: ${log.assetId}`;
      if (log.deploymentId) entry += ` | Deployment: ${log.deploymentId}`;
      if (log.payload) entry += ` | Payload: ${JSON.stringify(log.payload)}`;
      if (log.response) entry += ` | Response: ${JSON.stringify(log.response)}`;
      return entry;
    }).join('\n');

    return { logs: logString };
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    return { message: `Error: ${message}` };
  }
}

export async function unassignDatafile(deploymentId: string, fileId: string) {
  let logPayload = { deploymentId, fileId };
  try {
    let deployments = await readJsonFile<Deployment[]>(deploymentsFilePath);
    const deploymentIndex = deployments.findIndex(d => d.id === deploymentId);
    if (deploymentIndex === -1) throw new Error("Deployment not found");

    const fileToUnassign = deployments[deploymentIndex].files?.find(f => f.id === fileId);
    if (!fileToUnassign) throw new Error("File not found in deployment");

    // Move file back to staged
    const sourcePath = path.join(sourcefileDir, `${fileId}.csv`);
    const stagedPath = path.join(stagedDir, fileToUnassign.filename);
    await fs.rename(sourcePath, stagedPath);

    // Remove file from deployment
    deployments[deploymentIndex].files = deployments[deploymentIndex].files?.filter(f => f.id !== fileId);
    await writeJsonFile(deploymentsFilePath, deployments);

    // Reprocess data
    await processAndAnalyzeDeployment(deploymentId);

    revalidatePath('/');
    const response = { message: 'File unassigned successfully and moved back to staging.' };
    await writeLog({ action: 'unassignDatafile', status: 'success', deploymentId, payload: logPayload, response });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    const response = { message: `Error: ${message}` };
    await writeLog({ action: 'unassignDatafile', status: 'failure', deploymentId, payload: logPayload, response });
    return response;
  }
}

export async function deleteDatafile(deploymentId: string, fileId: string) {
  let logPayload = { deploymentId, fileId };
  try {
    let deployments = await readJsonFile<Deployment[]>(deploymentsFilePath);
    const deploymentIndex = deployments.findIndex(d => d.id === deploymentId);
    if (deploymentIndex === -1) throw new Error("Deployment not found");

    const fileToDelete = deployments[deploymentIndex].files?.find(f => f.id === fileId);
    if (!fileToDelete) throw new Error("File not found in deployment");

    // Delete the source file
    const sourcePath = path.join(sourcefileDir, `${fileId}.csv`);
    await fs.unlink(sourcePath);

    // Remove file from deployment
    deployments[deploymentIndex].files = deployments[deploymentIndex].files?.filter(f => f.id !== fileId);
    await writeJsonFile(deploymentsFilePath, deployments);

    // Reprocess data
    await processAndAnalyzeDeployment(deploymentId);
    
    revalidatePath('/');
    const response = { message: 'File permanently deleted.' };
    await writeLog({ action: 'deleteDatafile', status: 'success', deploymentId, payload: logPayload, response });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    const response = { message: `Error: ${message}` };
    await writeLog({ action: 'deleteDatafile', status: 'failure', deploymentId, payload: logPayload, response });
    return response;
  }
}

// == Staged File Actions ==
export async function uploadStagedFile(formData: FormData) {
  const file = formData.get('file') as File;
  if (!file) {
    return { message: 'Error: No file provided.' };
  }
  
  try {
    await fs.mkdir(stagedDir, { recursive: true });
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filePath = path.join(stagedDir, file.name);
    await fs.writeFile(filePath, buffer);
    return { message: 'File uploaded successfully' };
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    return { message: `Error: ${message}` };
  }
}

export async function getStagedFiles(): Promise<StagedFile[]> {
    try {
        await fs.mkdir(stagedDir, { recursive: true });
        const filenames = await fs.readdir(stagedDir);
        const files = await Promise.all(
            filenames.map(async (filename) => {
                if (filename.startsWith('.')) return null;
                const filePath = path.join(stagedDir, filename);
                const stats = await fs.stat(filePath);
                return {
                    filename,
                    path: filePath,
                    size: stats.size,
                    type: path.extname(filename),
                    uploadDate: stats.mtime.toISOString(),
                };
            })
        );
        return files.filter((file): file is StagedFile => file !== null);
    } catch (error) {
        console.error("Failed to get staged files:", error);
        return [];
    }
}

export async function deleteStagedFile(filename: string) {
  try {
    const filePath = path.join(stagedDir, filename);
    await fs.unlink(filePath);
    return { message: 'File deleted from staging.' };
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    return { message: `Error: ${message}` };
  }
}

export async function getStagedFileContent(filename: string): Promise<string | null> {
    try {
        const filePath = path.join(stagedDir, filename);
        const content = await fs.readFile(filePath, 'utf-8');
        return content;
    } catch (error) {
        console.error(`Failed to read staged file ${filename}:`, error);
        return null;
    }
}

export async function getSourceFileContent(filename: string): Promise<string | null> {
    try {
        const filePath = path.join(sourcefileDir, filename);
        const content = await fs.readFile(filePath, 'utf-8');
        return content;
    } catch (error) {
        console.error(`Failed to read source file ${filename}:`, error);
        return null;
    }
}

export async function reassignDatafile(formData: FormData) {
  const rawData = Object.fromEntries(formData);
  
  // Clean up "none" values from optional selects before validation
  Object.keys(rawData).forEach(key => {
    if (rawData[key] === 'none') {
        rawData[key] = undefined;
    }
  });
  
  const validatedFields = reassignDatafileSchema.safeParse(rawData);

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors, message: "Validation failed." };
  }
  
  const { deploymentId, fileId, ...columnMapping } = validatedFields.data;

  try {
      let deployments = await readJsonFile<Deployment[]>(deploymentsFilePath);
      const deploymentIndex = deployments.findIndex(d => d.id === deploymentId);
      if (deploymentIndex === -1) throw new Error("Deployment not found");
      
      const fileIndex = deployments[deploymentIndex].files?.findIndex(f => f.id === fileId);
      if (fileIndex === undefined || fileIndex === -1) throw new Error("File not found in deployment");

      const updatedFile = {
          ...deployments[deploymentIndex].files![fileIndex],
          columnMapping: {
              ...deployments[deploymentIndex].files![fileIndex].columnMapping,
              ...columnMapping,
          },
      };

      deployments[deploymentIndex].files![fileIndex] = updatedFile;
      await writeJsonFile(deploymentsFilePath, deployments);

      await processAndAnalyzeDeployment(deploymentId);
      
      revalidatePath('/');
      return { message: 'File re-assigned and re-processed successfully.', updatedFile };

  } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred.";
      return { message: `Error: ${message}` };
  }
}

async function processAndAnalyzeDeployment(deploymentId: string) {
    await writeLog({
        action: 'processAndAnalyzeDeployment',
        status: 'start',
        deploymentId,
        payload: { message: `Starting data processing for deployment ${deploymentId}` }
    });

    try {
        const deployments = await readJsonFile<Deployment[]>(deploymentsFilePath);
        const deployment = deployments.find(d => d.id === deploymentId);
        if (!deployment || !deployment.files || deployment.files.length === 0) {
            await writeLog({ action: 'processAndAnalyzeDeployment', status: 'warning', deploymentId, payload: { message: "No deployment or files found. Aborting." }});
            // When unassigning the last file, clear old data
            const deploymentDataPath = path.join(processedDir, deploymentId);
            await fs.mkdir(deploymentDataPath, { recursive: true });
            await writeJsonFile(path.join(deploymentDataPath, 'data.json'), []);
            await writeJsonFile(path.join(deploymentDataPath, 'events.json'), { totalPrecipitation: 0, events: [] });
            await writeJsonFile(path.join(deploymentDataPath, 'diagnostics.json'), {});
            return;
        }

        const assets = await readJsonFile<Asset[]>(assetsFilePath);
        const asset = assets.find(a => a.id === deployment.assetId);
        if (!asset) {
            await writeLog({ action: 'processAndAnalyzeDeployment', status: 'failure', deploymentId, payload: { message: "Asset not found for deployment." } });
            return;
        }
        
        const dataMap = new Map<number, ChartablePoint>();

        for (const file of deployment.files) {
            const sourcePath = path.join(sourcefileDir, `${file.id}.csv`);
            const fileContent = await fs.readFile(sourcePath, 'utf-8');
            const parseResult = Papa.parse(fileContent, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: true,
            });

            if (parseResult.errors.length > 0) {
                console.warn(`CSV parsing error in file ${file.filename}:`, parseResult.errors);
                continue; // Skip to next file
            }
            
            const dataPoints = (parseResult.data as any[]).slice(file.columnMapping.startRow - 1);

            dataPoints.forEach((row: any) => {
                const timestampStr = row[file.columnMapping.datetimeColumn];
                if (!timestampStr) return;
                
                const timestamp = new Date(timestampStr).getTime();
                if (isNaN(timestamp)) return;

                let point = dataMap.get(timestamp) || { timestamp };
                const { dataType, waterLevelColumn, precipitationColumn, temperatureColumn, barometerColumn } = file.columnMapping;

                if (waterLevelColumn) {
                    const rawLevel = row[waterLevelColumn];
                    if (typeof rawLevel === 'number') {
                        point.rawWaterLevel = rawLevel;
                        point.waterLevel = deployment.sensorElevation + rawLevel;
                    }
                }
                
                if (precipitationColumn) {
                     point.precipitation = (point.precipitation || 0) + (row[precipitationColumn] || 0);
                }

                if (dataType === 'sensor-suite') {
                    if (temperatureColumn) point.temperature = row[temperatureColumn];
                    if (barometerColumn) point.barometer = row[barometerColumn];
                }
                
                dataMap.set(timestamp, point);
            });
        }
        
        let allData = Array.from(dataMap.values()).sort((a, b) => a.timestamp - b.timestamp);

        if (allData.length === 0) {
            await writeLog({ action: 'processAndAnalyzeDeployment', status: 'warning', deploymentId, payload: { message: "No processable data points found in files." }});
            // Clear out old data if no new data
            await writeJsonFile(path.join(processedDir, deploymentId, 'data.json'), []);
            await writeJsonFile(path.join(processedDir, deploymentId, 'events.json'), { totalPrecipitation: 0, events: [] });
            await writeJsonFile(path.join(processedDir, deploymentId, 'diagnostics.json'), {});
            return;
        }

        // Fetch external weather data if necessary
        const hasPrecipitation = allData.some(p => p.precipitation !== undefined && p.precipitation !== null && p.precipitation > 0);
        const startDate = allData[0].timestamp;
        const endDate = allData[allData.length - 1].timestamp;

        if (!hasPrecipitation) {
            try {
                const weatherDataCsv = await getWeatherData({
                    latitude: asset.latitude,
                    longitude: asset.longitude,
                    startDate: new Date(startDate).toISOString(),
                    endDate: new Date(endDate).toISOString(),
                });

                if (weatherDataCsv) {
                    const weatherParse = Papa.parse(weatherDataCsv, { header: true, dynamicTyping: true });
                    
                    const weatherMap = new Map<number, { precipitation?: number, temperature?: number }>();
                    (weatherParse.data as any[]).forEach(row => {
                        if (!row.date || row.precipitation === undefined) return;
                        const timestamp = new Date(row.date).getTime();
                        if (!isNaN(timestamp)) {
                            weatherMap.set(timestamp, { precipitation: row.precipitation, temperature: row.temperature });
                        }
                    });

                    allData.forEach(point => {
                        const weatherPoint = weatherMap.get(point.timestamp);
                        if (weatherPoint) {
                            point.precipitation = (point.precipitation || 0) + (weatherPoint.precipitation || 0);
                            if (point.temperature === undefined && weatherPoint.temperature !== undefined) {
                                point.temperature = weatherPoint.temperature;
                            }
                        }
                    });
                }
            } catch (weatherError) {
                console.error("Could not fetch or merge weather data:", weatherError);
                await writeLog({
                    action: 'processAndAnalyzeDeployment',
                    status: 'warning',
                    deploymentId,
                    payload: { message: `Failed to get external weather data. Analysis will proceed without it. Error: ${weatherError instanceof Error ? weatherError.message : 'Unknown'}` }
                });
            }
        }
        
        // Final combined and sorted data
        allData.sort((a,b) => a.timestamp - b.timestamp);
        
        // Calculate cumulative daily precipitation
        const dailyPrecipMap = new Map<number, number>();
        allData.forEach(p => {
            if (p.precipitation !== undefined && p.precipitation !== null) {
              const dayStart = startOfDay(new Date(p.timestamp)).getTime();
              const currentTotal = dailyPrecipMap.get(dayStart) || 0;
              const newTotal = currentTotal + (p.precipitation || 0);
              dailyPrecipMap.set(dayStart, newTotal);
            }
        });
        allData.forEach(p => {
            const dayStart = startOfDay(new Date(p.timestamp)).getTime();
            p.dailyPrecipitation = dailyPrecipMap.get(dayStart) || 0;
        });

        // Run diagnostics and event segmentation
        const totalPrecipitation = allData.reduce((acc, p) => acc + (p.precipitation || 0), 0);

        const events: AnalysisPeriod[] = [];
        let currentEvent: AnalysisPeriod | null = null;
        const rainThreshold = 0.1; // mm
        const eventGapHours = 6;
        let lastRainTimestamp = 0;

        for (const point of allData) {
            const hasRain = (point.precipitation || 0) > rainThreshold;
            
            // Logic to close an event
            if (currentEvent && (point.timestamp - lastRainTimestamp > eventGapHours * 60 * 60 * 1000)) {
                events.push(currentEvent);
                currentEvent = null;
            }
            
            // Logic to start a new event
            if (hasRain && !currentEvent) {
                currentEvent = {
                    id: `event-${point.timestamp}`,
                    assetId: asset.id,
                    deploymentId,
                    startDate: point.timestamp,
                    endDate: point.timestamp,
                    totalPrecipitation: 0,
                    dataPoints: [],
                };
            }

            // If an event is active, add data to it
            if (currentEvent) {
                currentEvent.dataPoints.push(point);
                currentEvent.endDate = point.timestamp; // Always update the end date
                if (hasRain) {
                    currentEvent.totalPrecipitation += point.precipitation || 0;
                    lastRainTimestamp = point.timestamp;
                }
            }
        }
        
        // Add the last event if it's still open
        if (currentEvent) {
            events.push(currentEvent); 
        }

        // Basic analysis for each event
        for (const event of events) {
            const baselineTime = event.startDate - 3 * 60 * 60 * 1000;
            const baselinePoints = allData.filter(p => p.timestamp >= baselineTime && p.timestamp < event.startDate && p.waterLevel !== undefined);
            
            const validBaselinePoints = baselinePoints.filter(p => typeof p.waterLevel === 'number' && isFinite(p.waterLevel));
            
            const baselineElevation = validBaselinePoints.length > 0 
                ? validBaselinePoints.reduce((sum, p) => sum + p.waterLevel!, 0) / validBaselinePoints.length
                : allData.find(p => p.timestamp >= event.startDate && p.waterLevel !== undefined)?.waterLevel ?? 0;

            const validEventPoints = event.dataPoints.filter(p => typeof p.waterLevel === 'number' && isFinite(p.waterLevel));
            
            const peakPoint = validEventPoints.length > 0 
              ? validEventPoints.reduce((max, p) => (p.waterLevel! > max.waterLevel!) ? p : max, { waterLevel: -Infinity, timestamp: 0 } as ChartablePoint)
              : null;
            
            const peakElevation = peakPoint?.waterLevel ?? 0;
            const peakTimestamp = peakPoint?.timestamp ?? 0;
            
            const peakRise = (peakElevation && baselineElevation) ? peakElevation - baselineElevation : 0;
            
            const postEventTime = event.endDate + 48 * 60 * 60 * 1000;
            const postEventPoints = allData.filter(p => p.timestamp >= postEventTime - 60*60*1000 && p.timestamp <= postEventTime && p.waterLevel !== undefined);
            const postEventElevation = postEventPoints.length > 0 ? postEventPoints.reduce((sum, p) => sum + p.waterLevel!, 0) / postEventPoints.length : undefined;

            let timeToBaseline: number | undefined;
            if (peakTimestamp && baselineElevation) {
                const returnPoint = allData.find(p => p.timestamp > peakTimestamp && p.waterLevel !== undefined && p.waterLevel <= baselineElevation);
                if (returnPoint) {
                    timeToBaseline = (returnPoint.timestamp - peakTimestamp) / (1000 * 60 * 60); // in hours
                }
            }

            // Advanced Drawdown Analysis
            let primaryDrawdownDuration: string | undefined;
            let primaryDrawdownElevationChange: number | undefined;
            let drawdownAnalysis: string | undefined;

            if (peakTimestamp) {
                const drawdownPoints = allData
                    .filter(p => p.timestamp >= peakTimestamp && typeof p.waterLevel === 'number')
                    .map(p => ({ t: p.timestamp, wl: p.waterLevel! }));

                if (drawdownPoints.length > 10) { // Need enough points
                    let bestSplit = -1;
                    let maxSlopeDiff = -1;
                    const minSegmentLength = 5;

                    // Find best split point
                    for (let i = minSegmentLength; i < drawdownPoints.length - minSegmentLength; i++) {
                        const segment1 = drawdownPoints.slice(0, i);
                        const segment2 = drawdownPoints.slice(i);
                        
                        const slope1 = (segment1[i-1].wl - segment1[0].wl) / (segment1[i-1].t - segment1[0].t);
                        const slope2 = (segment2[segment2.length-1].wl - segment2[0].wl) / (segment2[segment2.length-1].t - segment2[0].t);
                        
                        const slopeDiff = Math.abs(slope1 - slope2);
                        if (slopeDiff > maxSlopeDiff) {
                            maxSlopeDiff = slopeDiff;
                            bestSplit = i;
                        }
                    }

                    if (bestSplit !== -1) {
                        const splitPoint = drawdownPoints[bestSplit];
                        primaryDrawdownDuration = formatDistance(new Date(peakTimestamp), new Date(splitPoint.t), { includeSeconds: true });
                        primaryDrawdownElevationChange = peakElevation - splitPoint.wl;
                        
                        const hoursToLevelOut = (splitPoint.t - peakTimestamp) / (1000 * 60 * 60);
                        const designDrawdown = deployment.designDrawdown || 48; // Default 48h
                        if (hoursToLevelOut < designDrawdown * 0.75) drawdownAnalysis = "Fast";
                        else if (hoursToLevelOut > designDrawdown * 1.25) drawdownAnalysis = "Slow";
                        else drawdownAnalysis = "Normal";

                    } else {
                         drawdownAnalysis = "Incomplete";
                    }
                } else {
                    drawdownAnalysis = "Incomplete";
                }
            }

            const poolRecoveryDifference = (postEventElevation !== undefined) 
                ? postEventElevation - asset.permanentPoolElevation
                : undefined;

            event.analysis = {
                peakTimestamp,
                peakElevation,
                baselineElevation,
                postEventElevation,
                timeToBaseline,
                primaryDrawdownDuration,
                primaryDrawdownElevationChange,
                drawdownAnalysis,
                poolRecoveryDifference,
            };

            // Automated disregard logic
            if (event.totalPrecipitation < 1 && peakRise < 0.002) {
                event.analysis.disregarded = true;
                event.analysis.notes = "Automatically disregarded due to minor precipitation and water level change.";
            }
        }
        
        const weatherSummary: WeatherSummary = {
            totalPrecipitation,
            events,
        };

        const diagnostics = runDiagnostics({
            allData,
            events,
            permanentPoolElevation: asset.permanentPoolElevation,
            designDrawdown: deployment.designDrawdown || 48,
        });

        // Write processed files
        const deploymentDataPath = path.join(processedDir, deploymentId);
        await fs.mkdir(deploymentDataPath, { recursive: true });
        await writeJsonFile(path.join(deploymentDataPath, 'data.json'), allData);
        await writeJsonFile(path.join(deploymentDataPath, 'events.json'), weatherSummary);
        await writeJsonFile(path.join(deploymentDataPath, 'diagnostics.json'), diagnostics);
        
        await writeLog({
            action: 'processAndAnalyzeDeployment',
            status: 'success',
            deploymentId,
            payload: { message: `Successfully processed ${allData.length} data points and found ${events.length} events.` }
        });

    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error("Data processing failed:", error);
        await writeLog({
            action: 'processAndAnalyzeDeployment',
            status: 'failure',
            deploymentId,
            response: { message: `Error: ${message}` }
        });
    }
}
    

// == Analysis Actions ==

export async function getProcessedData(deploymentId: string): Promise<{ data: ChartablePoint[], weatherSummary: WeatherSummary | null }> {
    try {
        const dataFilePath = path.join(processedDir, deploymentId, 'data.json');
        const eventsFilePath = path.join(processedDir, deploymentId, 'events.json');

        const chartData = await readJsonFile<ChartablePoint[]>(dataFilePath);
        const eventData = await readJsonFile<WeatherSummary>(eventsFilePath);

        return { data: chartData, weatherSummary: eventData };
    } catch (error) {
        console.error(`Failed to get processed data for deployment ${deploymentId}:`, error);
        return { data: [], weatherSummary: null };
    }
}

export async function saveAnalysis(data: any) {
  const logPayload = { ...data };
  const validatedFields = saveAnalysisSchema.safeParse(data);

  if (!validatedFields.success) {
    const response = { errors: validatedFields.error.flatten().fieldErrors, message: 'Validation failed.' };
    await writeLog({ action: 'saveAnalysis', status: 'failure', payload: logPayload, response });
    return response;
  }

  const { eventId, ...analysisData } = validatedFields.data;

  try {
    const deployments = await readJsonFile<Deployment[]>(deploymentsFilePath);
    let targetDeploymentId: string | null = null;

    for (const deployment of deployments) {
      const eventsFilePath = path.join(processedDir, deployment.id, 'events.json');
      try {
        const weatherSummary = await readJsonFile<WeatherSummary>(eventsFilePath);
        if (!weatherSummary || !weatherSummary.events) continue;

        const eventIndex = weatherSummary.events.findIndex(e => e.id === eventId);
        
        if (eventIndex !== -1) {
          targetDeploymentId = deployment.id;
          
          const eventToUpdate = weatherSummary.events[eventIndex];
          weatherSummary.events[eventIndex] = {
            ...eventToUpdate,
            analysis: {
              ...(eventToUpdate.analysis || {}),
              ...analysisData,
            }
          };

          await writeJsonFile(eventsFilePath, weatherSummary);
          await writeLog({ action: 'saveAnalysis', status: 'success', deploymentId: targetDeploymentId, payload: logPayload });
          revalidatePath('/');
          return { message: 'Analysis saved successfully.', savedData: { eventId, ...analysisData } };
        }
      } catch (e) {
        // File might not exist for this deployment, or is empty. Continue.
      }
    }

    if (!targetDeploymentId) {
      throw new Error(`Could not find event with ID ${eventId} in any deployment.`);
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    const response = { message: `Error: ${message}` };
    await writeLog({ action: 'saveAnalysis', status: 'failure', payload: logPayload, response });
    return response;
  }
}

export async function getDeploymentAnalysis(deploymentId: string): Promise<OverallAnalysisData | null> {
    try {
        const analysisFilePath = path.join(processedDir, deploymentId, 'deployment-analysis.json');
        const analysisData = await readJsonFile<OverallAnalysisData>(analysisFilePath);
        return Object.keys(analysisData).length > 0 ? analysisData : null;
    } catch (error) {
        console.error(`Failed to get overall analysis for deployment ${deploymentId}:`, error);
        return null;
    }
}

export async function getDeploymentDiagnostics(deploymentId: string): Promise<any> {
    try {
        const diagnosticsFilePath = path.join(processedDir, deploymentId, 'diagnostics.json');
        const diagnosticsData = await readJsonFile<any>(diagnosticsFilePath);
        return Object.keys(diagnosticsData).length > 0 ? diagnosticsData : null;
    } catch (error) {
        console.error(`Failed to get diagnostics for deployment ${deploymentId}:`, error);
        return null;
    }
}

export async function getRawDeploymentAnalysisJson(deploymentId: string): Promise<string> {
    try {
        const analysisFilePath = path.join(processedDir, deploymentId, 'deployment-analysis.json');
        const analysisData = await readJsonFile<OverallAnalysisData>(analysisFilePath);
        if (Object.keys(analysisData).length > 0) {
            return JSON.stringify(analysisData, null, 2);
        }
        return JSON.stringify({ message: "No analysis data found for this deployment on the server." }, null, 2);
    } catch (error) {
        console.error(`Failed to get raw overall analysis for deployment ${deploymentId}:`, error);
        return JSON.stringify({ error: `Failed to fetch analysis data: ${error instanceof Error ? error.message : 'Unknown error'}` }, null, 2);
    }
}

export async function saveDeploymentAnalysis(data: any) {
  const logPayload = { ...data };
  const validatedFields = saveDeploymentAnalysisSchema.safeParse(data);

  if (!validatedFields.success) {
    const response = { errors: validatedFields.error.flatten().fieldErrors, message: 'Validation failed.' };
    await writeLog({ action: 'saveDeploymentAnalysis', status: 'failure', payload: logPayload, response });
    return response;
  }
  
  const { deploymentId, ...analysisData } = validatedFields.data;
  
  try {
    const analysisFilePath = path.join(processedDir, deploymentId, 'deployment-analysis.json');
    const existingAnalysis = await readJsonFile<OverallAnalysisData>(analysisFilePath);

    const savedData: OverallAnalysisData = {
        ...existingAnalysis,
        ...analysisData,
        deploymentId,
        lastUpdated: new Date().toISOString(),
    };
    
    await writeJsonFile(analysisFilePath, savedData);

    const deployments = await readJsonFile<Deployment[]>(deploymentsFilePath);
    const deployment = deployments.find(d => d.id === deploymentId);

    if (deployment && analysisData.status) {
        const assets = await readJsonFile<Asset[]>(assetsFilePath);
        const updatedAssets = assets.map(asset => {
            if (asset.id === deployment.assetId) {
                return { ...asset, status: analysisData.status as AssetStatus };
            }
            return asset;
        });
        await writeJsonFile(assetsFilePath, updatedAssets);
    }

    revalidatePath('/');
    const response = { message: 'Deployment analysis saved successfully.', savedData };
    await writeLog({ action: 'saveDeploymentAnalysis', status: 'success', deploymentId, payload: logPayload, response });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    const response = { message: `Error: ${message}` };
    await writeLog({ action: 'saveDeploymentAnalysis', status: 'failure', deploymentId, payload: logPayload, response });
    return response;
  }
}
