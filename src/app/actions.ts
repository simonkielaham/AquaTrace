
'use server';

import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { Asset, Deployment, ActivityLog, DataFile, StagedFile, SurveyPoint, ChartablePoint, AnalysisPeriod, WeatherSummary, SavedAnalysisData, OverallAnalysisData, OperationalAction } from '@/lib/placeholder-data';
import Papa from 'papaparse';
import { format, formatDistance } from 'date-fns';
import { getWeatherData } from '../../sourceexamples/weather-service';


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
});


const editDeploymentSchema = z.object({
  name: z.string().optional(),
  sensorId: z.string().min(1),
  sensorElevation: z.coerce.number(),
  stillwellTop: z.coerce.number().optional(),
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

const saveOverallAnalysisSchema = z.object({
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
      // For files that are expected to be arrays or objects, return an empty version instead of erroring
      if (filePath.endsWith('s.json') || filePath.endsWith('log.json') || path.basename(filePath) === 'events.json' || path.basename(filePath) === 'diagnostics.json') return [] as T;
      
      if (filePath.endsWith('results.json') || filePath.endsWith('analysis.json') || path.basename(filePath) === 'data.json') return {} as T;

      return {} as T; // Default empty object for other missing files
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


// == Manual Survey Point Actions ==

export async function addSurveyPoint(assetId: string, data: any) {
  const logPayload = { assetId, data };
  const validatedFields = surveyPointSchema.safeParse(data);

  if (!validatedFields.success) {
    const response = { errors: validatedFields.error.flatten().fieldErrors, message: 'Validation failed.' };
    await writeLog({ action: 'addSurveyPoint', status: 'failure', assetId, payload: logPayload, response });
    return response;
  }
  const { timestamp, elevation, source, tapeDownMeasurement, stillwellTopElevation, deploymentId } = validatedFields.data;

  try {
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
    await writeLog({ action: 'addSurveyPoint', status: 'failure', assetId, payload: logPayload, response });
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

export async function addOperationalAction(assetId: string, data: any) {
  const logPayload = { assetId, data };
  const validatedFields = operationalActionSchema.safeParse(data);

  if (!validatedFields.success) {
    const response = { errors: validatedFields.error.flatten().fieldErrors, message: 'Validation failed.' };
    await writeLog({ action: 'addOperationalAction', status: 'failure', assetId, payload: logPayload, response });
    return response;
  }
  const { timestamp, action, deploymentId } = validatedFields.data;

  try {
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
    await writeLog({ action: 'addOperationalAction', status: 'failure', assetId, payload: logPayload, response });
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
