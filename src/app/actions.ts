

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
const surveyPointsFilePath = path.join(dataDir, 'survey-points.json');
const operationalActionsFilePath = path.join(dataDir, 'operational-actions.json');
const analysisResultsFilePath = path.join(dataDir, 'analysis-results.json');
const overallAnalysisFilePath = path.join(dataDir, 'overall-analysis.json');
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
  deploymentId: z.string().optional(),
});

const operationalActionSchema = z.object({
    timestamp: z.string().datetime(),
    action: z.string().min(3, "Action description is required."),
});

const saveAnalysisSchema = z.object({
  eventId: z.string(),
  notes: z.string().optional(),
  status: z.enum(["normal" , "not_normal" , "holding_water" , "leaking"]).optional(),
  analystInitials: z.string().min(1, "Analyst initials are required."),
  disregarded: z.boolean().optional(),
});

const saveOverallAnalysisSchema = z.object({
    assetId: z.string(),
    permanentPoolPerformance: z.enum(['sits_at_pool', 'sits_above_pool', 'sits_below_pool', 'fluctuates']).optional(),
    estimatedControlElevation: z.coerce.number().optional(),
    rainResponse: z.enum(['as_expected', 'slow_response', 'fast_response', 'no_response']).optional(),
    furtherInvestigation: z.enum(['not_needed', 'recommended', 'required']).optional(),
    summary: z.string().optional(),
    analystInitials: z.string().min(1, "Analyst initials are required."),
    status: z.enum(["Operating As Expected", "Minor Concerns", "Critical Concerns"]),
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
      if (filePath.endsWith('s.json') || filePath.endsWith('log.json') || filePath.endsWith('points.json') || filePath.endsWith('actions.json') || path.basename(filePath) === 'events.json' || path.basename(filePath) === 'diagnostics.json') return [] as T;
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
    const surveyPoints = await readJsonFile<SurveyPoint[]>(surveyPointsFilePath);
    
    // We don't need to align to sensor data here anymore, just save the point.
    // The alignment will happen in getProcessedData.
    const finalTimestamp = new Date(timestamp).getTime();
    
    const newPoint: SurveyPoint = {
      id: `survey-${Date.now()}`,
      assetId,
      timestamp: finalTimestamp,
      elevation: parseFloat(elevation.toString()),
      source,
      tapeDownMeasurement,
      stillwellTopElevation,
      deploymentId
    };
    
    surveyPoints.push(newPoint);
    await writeJsonFile(surveyPointsFilePath, surveyPoints);

    revalidatePath('/');
    
    const response = { message: 'Survey point added successfully', newPoint };
    await writeLog({ action: 'addSurveyPoint', status: 'success', assetId, payload: logPayload, response });
    return response;

  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    const response = { message: `Error: ${message}` };
    await writeLog({ action: 'addSurveyPoint', status: 'failure', assetId, payload: logPayload, response });
    return response;
  }
}

export async function getSurveyPoints(assetId: string): Promise<SurveyPoint[]> {
  try {
    const allPoints = await readJsonFile<SurveyPoint[]>(surveyPointsFilePath);
    return allPoints.filter(p => p.assetId === assetId).sort((a,b) => a.timestamp - b.timestamp);
  } catch (error) {
    console.error(`Failed to get survey points for asset ${assetId}:`, error);
    return [];
  }
}

export async function deleteSurveyPoint(pointId: string) {
    const logPayload = { pointId };
    try {
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
        await writeLog({ action: 'deleteSurveyPoint', status: 'success', assetId: pointToDelete.assetId, payload: logPayload, response });
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
  const { timestamp, action } = validatedFields.data;

  try {
    const actions = await readJsonFile<OperationalAction[]>(operationalActionsFilePath);
    
    const finalTimestamp = new Date(timestamp).getTime();
    
    const newAction: OperationalAction = {
      id: `op-${Date.now()}`,
      assetId,
      timestamp: finalTimestamp,
      action
    };
    
    actions.push(newAction);
    await writeJsonFile(operationalActionsFilePath, actions);

    revalidatePath('/');
    
    const response = { message: 'Operational action logged successfully', newAction };
    await writeLog({ action: 'addOperationalAction', status: 'success', assetId, payload: logPayload, response });
    return response;

  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    const response = { message: `Error: ${message}` };
    await writeLog({ action: 'addOperationalAction', status: 'failure', assetId, payload: logPayload, response });
    return response;
  }
}

export async function getOperationalActions(assetId: string): Promise<OperationalAction[]> {
  try {
    const allActions = await readJsonFile<OperationalAction[]>(operationalActionsFilePath);
    return allActions.filter(p => p.assetId === assetId).sort((a,b) => a.timestamp - b.timestamp);
  } catch (error) {
    console.error(`Failed to get operational actions for asset ${assetId}:`, error);
    return [];
  }
}

export async function deleteOperationalAction(actionId: string) {
    const logPayload = { actionId };
    try {
        let actions = await readJsonFile<OperationalAction[]>(operationalActionsFilePath);
        const actionToDelete = actions.find(a => a.id === actionId);
        
        if (!actionToDelete) {
             const response = { message: `Error: Action with ID ${actionId} not found.` };
             await writeLog({ action: 'deleteOperationalAction', status: 'failure', payload: logPayload, response });
             return response;
        }

        const updatedActions = actions.filter(p => p.id !== actionId);
        await writeJsonFile(operationalActionsFilePath, updatedActions);

        revalidatePath('/');

        const response = { message: 'Operational action deleted successfully.' };
        await writeLog({ action: 'deleteOperationalAction', status: 'success', assetId: actionToDelete.assetId, payload: logPayload, response });
        return response;
    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        const response = { message: `Error: ${message}` };
        await writeLog({ action: 'deleteOperationalAction', status: 'failure', payload: logPayload, response });
        return response;
    }
}


// == Staged File Management Actions ==

export async function uploadStagedFile(formData: FormData) {
  const file = formData.get('file') as File;
  if (!file) {
    return { message: "Error: No file provided." };
  }

  const logPayload = { filename: file.name, size: file.size, type: file.type };

  try {
    await fs.mkdir(stagedDir, { recursive: true });
    const filePath = path.join(stagedDir, file.name);
    
    // Check if file already exists
    try {
      await fs.access(filePath);
      const response = { message: `Error: File "${file.name}" already exists.` };
      await writeLog({ action: 'uploadStagedFile', status: 'failure', payload: logPayload, response});
      return response;
    } catch {
      // File does not exist, proceed
    }
    
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await fs.writeFile(filePath, buffer);

    revalidatePath('/');
    const response = { message: "File staged successfully." };
    await writeLog({ action: 'uploadStagedFile', status: 'success', payload: logPayload, response });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    const response = { message: `Error: ${message}` };
    await writeLog({ action: 'uploadStagedFile', status: 'failure', payload: logPayload, response });
    return response;
  }
}

export async function getStagedFiles(): Promise<StagedFile[]> {
    try {
        await fs.mkdir(stagedDir, { recursive: true });
        const filenames = await fs.readdir(stagedDir);
        const files = await Promise.all(
            filenames.map(async (name) => {
                const filePath = path.join(stagedDir, name);
                const stats = await fs.stat(filePath);
                return {
                    filename: name,
                    path: filePath,
                    size: stats.size,
                    type: path.extname(name),
                    uploadDate: stats.birthtime.toISOString()
                };
            })
        );
        return files.sort((a,b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
    } catch (error) {
        console.error("Failed to get staged files:", error);
        return [];
    }
}

export async function getStagedFileContent(filename: string): Promise<string | null> {
    const filePath = path.join(stagedDir, filename);
    try {
        await fs.access(filePath);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        return fileContent;
    } catch (error) {
        console.error(`Failed to read staged file ${filename}:`, error);
        return null;
    }
}

export async function getSourceFileContent(filename: string): Promise<string | null> {
    const filePath = path.join(sourcefileDir, filename);
    try {
        await fs.access(filePath);
        return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
        console.error(`Failed to read source file ${filename}:`, error);
        return null;
    }
}

export async function deleteStagedFile(filename: string) {
  const logPayload = { filename };
  try {
    const filePath = path.join(stagedDir, filename);
    await fs.unlink(filePath);
    
    revalidatePath('/');
    const response = { message: `File ${filename} deleted successfully.` };
    await writeLog({ action: 'deleteStagedFile', status: 'success', payload: logPayload, response });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    const response = { message: `Error: ${message}` };
    await writeLog({ action: 'deleteStagedFile', status: 'failure', payload: logPayload, response });
    return response;
  }
}

// Reusable data processing function
async function processCsvData(fileContent: string, columnMapping: Omit<z.infer<typeof baseDatafileSchema>, 'dataType'>) {
    const { datetimeColumn, waterLevelColumn, precipitationColumn, sensorPressureColumn, temperatureColumn, barometerColumn, startRow } = columnMapping;

    const parsedCsv = await new Promise<Papa.ParseResult<any>>((resolve, reject) => {
        Papa.parse(fileContent, {
            header: true,
            skipEmptyLines: true,
            complete: (results: Papa.ParseResult<any>) => {
                if (!results.meta.fields || results.meta.fields.length === 0) {
                    return reject(new Error("Could not determine headers from CSV."));
                }
                const data = startRow > 1 ? results.data.slice(startRow - 2) : results.data;
                resolve({ ...results, data });
            },
            error: (err) => reject(err),
        });
    });

    const processedData = parsedCsv.data.map((row: any) => {
        const dateValue = row[datetimeColumn];
        if (!dateValue) return null;
        const timestamp = new Date(dateValue);
        if (isNaN(timestamp.getTime())) return null;

        const record: { timestamp: string; [key: string]: number | string } = { timestamp: timestamp.toISOString() };
        
        const columnMap = {
            waterLevel: waterLevelColumn,
            precipitation: precipitationColumn,
            sensorPressure: sensorPressureColumn,
            temperature: temperatureColumn,
            barometer: barometerColumn
        };
        
        let hasValue = false;
        for (const [key, colName] of Object.entries(columnMap)) {
            if (colName && row[colName] !== null && row[colName] !== undefined && row[colName] !== '') {
                const value = parseFloat(row[colName]);
                if (!isNaN(value)) {
                    record[key] = value;
                    hasValue = true;
                }
            }
        }
        
        return hasValue ? record : null;
    }).filter(p => p !== null) as { timestamp: string, value: number }[];

    if (processedData.length === 0) {
      throw new Error("No valid data points could be processed. Check column mapping and start row.");
    }
    
    return processedData;
}


export async function assignDatafileToDeployment(formData: FormData) {
  const rawData = {
    deploymentId: formData.get('deploymentId'),
    assetId: formData.get('assetId'),
    filename: formData.get('filename'),
    dataType: formData.get('dataType'),
    datetimeColumn: formData.get('datetimeColumn'),
    waterLevelColumn: formData.get('waterLevelColumn') || undefined,
    precipitationColumn: formData.get('precipitationColumn') || undefined,
    sensorPressureColumn: formData.get('sensorPressureColumn') || undefined,
    temperatureColumn: formData.get('temperatureColumn') || undefined,
    barometerColumn: formData.get('barometerColumn') || undefined,
    startRow: formData.get('startRow'),
  };
  
  const validatedFields = assignDatafileSchema.safeParse(rawData);
  if (!validatedFields.success) {
     const response = { errors: validatedFields.error.flatten().fieldErrors, message: 'Validation failed.' };
     await writeLog({ action: 'assignDatafile', status: 'failure', payload: rawData, response });
     return response;
  }
  
  const { filename, deploymentId, ...columnMapping } = validatedFields.data;
  const stagedFilePath = path.join(stagedDir, filename);
  const deploymentDir = path.join(processedDir, deploymentId);


  try {
    const fileContent = await fs.readFile(stagedFilePath, 'utf-8');
    const processedData = await processCsvData(fileContent, columnMapping);
    
    const timestamps = processedData.map(p => new Date(p.timestamp).getTime());
    const minDate = new Date(Math.min(...timestamps));
    const maxDate = new Date(Math.max(...timestamps));

    const newDataFile: DataFile = {
      id: `file-${Date.now()}`,
      filename: filename,
      dataType: columnMapping.dataType,
      columnMapping: columnMapping, // Save the mapping
      uploadDate: new Date().toISOString(),
      startDate: minDate.toISOString(),
      endDate: maxDate.toISOString(),
      rowCount: processedData.length
    };
    
    // Save processed data and archive source file
    await fs.mkdir(deploymentDir, { recursive: true });
    await fs.mkdir(sourcefileDir, { recursive: true });

    // New: Save processed data to deployment-specific folder
    const dataFilePath = path.join(deploymentDir, 'data.json');
    const existingData = await readJsonFile<{[key: string]: any}>(dataFilePath);
    existingData[newDataFile.id] = processedData;
    await writeJsonFile(dataFilePath, existingData);

    const sourceFilePath = path.join(sourcefileDir, `${newDataFile.id}.csv`);
    await fs.rename(stagedFilePath, sourceFilePath); // Move and rename with ID

    // Update deployments metadata
    const deployments = await readJsonFile<Deployment[]>(deploymentsFilePath);
    const deploymentIndex = deployments.findIndex(d => d.id === deploymentId);
    if (deploymentIndex === -1) throw new Error('Deployment not found');
    
    deployments[deploymentIndex].files = [...(deployments[deploymentIndex].files || []), newDataFile];
    await writeJsonFile(deploymentsFilePath, deployments);

    revalidatePath('/');
    
    const response = { message: 'Datafile assigned successfully', newFile: newDataFile };
    await writeLog({ action: 'assignDatafile', status: 'success', payload: validatedFields.data, response });
    return response;

  } catch(error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    const response = { message: `Error: ${message}` };
    await writeLog({ action: 'assignDatafile', status: 'failure', payload: validatedFields.data, response });
    return response;
  }
}

export async function reassignDatafile(formData: FormData) {
  const rawData = {
    deploymentId: formData.get('deploymentId'),
    fileId: formData.get('fileId'),
    filename: formData.get('filename'),
    dataType: formData.get('dataType'),
    datetimeColumn: formData.get('datetimeColumn'),
    waterLevelColumn: formData.get('waterLevelColumn') || undefined,
    precipitationColumn: formData.get('precipitationColumn') || undefined,
    sensorPressureColumn: formData.get('sensorPressureColumn') || undefined,
    temperatureColumn: formData.get('temperatureColumn') || undefined,
    barometerColumn: formData.get('barometerColumn') || undefined,
    startRow: formData.get('startRow'),
  };

  const validatedFields = reassignDatafileSchema.safeParse(rawData);
   if (!validatedFields.success) {
     const response = { errors: validatedFields.error.flatten().fieldErrors, message: 'Validation failed.' };
     await writeLog({ action: 'reassignDatafile', status: 'failure', payload: rawData, response });
     return response;
  }
  
  const { fileId, deploymentId, filename, ...columnMapping } = validatedFields.data;
  const sourceFilePath = path.join(sourcefileDir, `${fileId}.csv`);
  const deploymentDir = path.join(processedDir, deploymentId);


  try {
    const fileContent = await fs.readFile(sourceFilePath, 'utf-8');
    const processedData = await processCsvData(fileContent, columnMapping);

    const timestamps = processedData.map(p => new Date(p.timestamp).getTime());
    const minDate = new Date(Math.min(...timestamps));
    const maxDate = new Date(Math.max(...timestamps));

    // Overwrite existing processed file data in the deployment's data.json
    const dataFilePath = path.join(deploymentDir, 'data.json');
    const existingData = await readJsonFile<{[key: string]: any}>(dataFilePath);
    existingData[fileId] = processedData;
    await writeJsonFile(dataFilePath, existingData);

    // Update the datafile metadata within the deployment
    const deployments = await readJsonFile<Deployment[]>(deploymentsFilePath);
    const deploymentIndex = deployments.findIndex(d => d.id === deploymentId);
    if (deploymentIndex === -1) throw new Error('Deployment not found');

    const fileIndex = deployments[deploymentIndex].files?.findIndex(f => f.id === fileId);
    if (fileIndex === undefined || fileIndex === -1) throw new Error('Datafile not found in deployment');

    deployments[deploymentIndex].files![fileIndex] = {
        ...deployments[deploymentIndex].files![fileIndex],
        dataType: columnMapping.dataType,
        columnMapping: columnMapping,
        startDate: minDate.toISOString(),
        endDate: maxDate.toISOString(),
        rowCount: processedData.length,
    };

    await writeJsonFile(deploymentsFilePath, deployments);

    revalidatePath('/');
    
    const response = { message: 'Datafile re-assigned successfully', updatedFile: deployments[deploymentIndex].files![fileIndex] };
    await writeLog({ action: 'reassignDatafile', status: 'success', payload: validatedFields.data, response });
    return response;

  } catch(error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    const response = { message: `Error: ${message}` };
    await writeLog({ action: 'reassignDatafile', status: 'failure', payload: validatedFields.data, response });
    return response;
  }
}


export async function unassignDatafile(deploymentId: string, fileId: string) {
    const logPayload = { deploymentId, fileId };
    try {
        const deployments = await readJsonFile<Deployment[]>(deploymentsFilePath);
        const deploymentIndex = deployments.findIndex(d => d.id === deploymentId);

        if (deploymentIndex === -1) throw new Error("Deployment not found.");
        
        const deployment = deployments[deploymentIndex];
        const file = deployment.files?.find(f => f.id === fileId);
        
        if (!file) throw new Error("Datafile not found in this deployment.");

        // Move source file back to staging
        const sourceFilePath = path.join(sourcefileDir, `${fileId}.csv`);
        const stagedFilePath = path.join(stagedDir, file.filename);
        try {
            await fs.rename(sourceFilePath, stagedFilePath);
        } catch (e) {
            if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
                console.error(`Could not move source file back to staging ${sourceFilePath}:`, e);
            }
        }

        // Delete processed data from the deployment's data.json
        const dataFilePath = path.join(processedDir, deploymentId, 'data.json');
        try {
            const existingData = await readJsonFile<{[key: string]: any}>(dataFilePath);
            delete existingData[fileId];
            await writeJsonFile(dataFilePath, existingData);
        } catch (e) {
            if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
                console.error(`Could not update processed data file ${dataFilePath}:`, e);
            }
        }

        // Remove file from deployment metadata
        deployments[deploymentIndex].files = deployment.files?.filter(f => f.id !== fileId);
        await writeJsonFile(deploymentsFilePath, deployments);
        
        revalidatePath('/');
        const response = { message: `File ${file.filename} unassigned and returned to staging.` };
        await writeLog({ action: 'unassignDatafile', status: 'success', assetId: deployment.assetId, deploymentId, payload: logPayload, response });
        return response;
    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        const response = { message: `Error: ${message}` };
        await writeLog({ action: 'unassignDatafile', status: 'failure', payload: logPayload, response });
        return response;
    }
}

export async function deleteDatafile(deploymentId: string, fileId: string) {
    const logPayload = { deploymentId, fileId };
    try {
        const deployments = await readJsonFile<Deployment[]>(deploymentsFilePath);
        const deploymentIndex = deployments.findIndex(d => d.id === deploymentId);

        if (deploymentIndex === -1) throw new Error("Deployment not found.");
        const deployment = deployments[deploymentIndex];
        const file = deployment.files?.find(f => f.id === fileId);
        if (!file) throw new Error("Datafile not found in this deployment.");

        // Remove file from deployment metadata
        deployments[deploymentIndex].files = deployment.files?.filter(f => f.id !== fileId);
        await writeJsonFile(deploymentsFilePath, deployments);

        // Delete processed data from the deployment's data.json
        const dataFilePath = path.join(processedDir, deploymentId, 'data.json');
        try {
            const existingData = await readJsonFile<{[key: string]: any}>(dataFilePath);
            delete existingData[fileId];
            await writeJsonFile(dataFilePath, existingData);
        } catch (e) {
             if ((e as NodeJS.ErrnoException).code !== 'ENOENT') console.error(`Could not update processed data file ${dataFilePath}:`, e);
        }
        
        // Delete source file
        const sourceFilePath = path.join(sourcefileDir, `${fileId}.csv`);
         try {
            await fs.unlink(sourceFilePath);
        } catch (e) {
             if ((e as NodeJS.ErrnoException).code !== 'ENOENT') console.error(`Could not delete source file ${sourceFilePath}:`, e);
        }
        
        revalidatePath('/');
        const response = { message: `File ${file.filename} permanently deleted.` };
        await writeLog({ action: 'deleteDatafile', status: 'success', assetId: deployment.assetId, deploymentId, payload: logPayload, response });
        return response;
    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        const response = { message: `Error: ${message}` };
        await writeLog({ action: 'deleteDatafile', status: 'failure', payload: logPayload, response });
        return response;
    }
}


export async function getProcessedData(assetId: string): Promise<{ data: ChartablePoint[], weatherSummary: WeatherSummary }> {
  try {
    const assets = await readJsonFile<Asset[]>(assetsFilePath);
    const asset = assets.find(a => a.id === assetId);
    if (!asset) {
        console.error("Failed to find asset for data processing:", assetId);
        return { data: [], weatherSummary: { totalPrecipitation: 0, events: [] } };
    }

    const deployments = await readJsonFile<Deployment[]>(deploymentsFilePath);
    const surveyPoints = await getSurveyPoints(assetId);
    const operationalActions = await getOperationalActions(assetId);
    const savedAnalysis = await readJsonFile<{[key: string]: SavedAnalysisData}>(analysisResultsFilePath);

    const assetDeployments = deployments.filter(d => d.assetId === assetId);

    const dataMap = new Map<number, ChartablePoint>();
    let allRawDataSources: any[] = [];
    let minDataDate: Date | null = null;
    let maxDataDate: Date | null = null;
    let hasPrecipitationInData = false;

    // First pass: Collect all data sources and determine the date range
    for (const deployment of assetDeployments) {
        const deploymentDir = path.join(processedDir, deployment.id);
        const dataFilePath = path.join(deploymentDir, 'data.json');

        try {
            const deploymentData = await readJsonFile<{[key: string]: any[]}>(dataFilePath);
            const fileData = Object.values(deploymentData).flat();
            
            if (fileData.some(d => d.precipitation !== undefined)) {
                hasPrecipitationInData = true;
            }

            allRawDataSources.push({ type: 'file', data: fileData, deployment });

            fileData.forEach(d => {
                const timestamp = new Date(d.timestamp).getTime();
                if (isNaN(timestamp)) return;
                if (!minDataDate || timestamp < minDataDate.getTime()) minDataDate = new Date(timestamp);
                if (!maxDataDate || timestamp > maxDataDate.getTime()) maxDataDate = new Date(timestamp);
            });
        } catch (e) {
            if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
                console.error(`Could not read processed file ${dataFilePath}:`, e);
            }
        }
    }
    allRawDataSources.push({ type: 'surveys', data: surveyPoints });
    surveyPoints.forEach(sp => {
        if (!minDataDate || sp.timestamp < minDataDate.getTime()) minDataDate = new Date(sp.timestamp);
        if (!maxDataDate || sp.timestamp > maxDataDate.getTime()) maxDataDate = new Date(sp.timestamp);
    });
    
    allRawDataSources.push({ type: 'actions', data: operationalActions });
    operationalActions.forEach(oa => {
        if (!minDataDate || oa.timestamp < minDataDate.getTime()) minDataDate = new Date(oa.timestamp);
        if (!maxDataDate || oa.timestamp > maxDataDate.getTime()) maxDataDate = new Date(oa.timestamp);
    });


    // Create a master map of all unique timestamps from all sources
    allRawDataSources.forEach(source => {
        source.data.forEach((item: any) => {
            const timestamp = new Date(item.timestamp).getTime();
            if(!isNaN(timestamp) && !dataMap.has(timestamp)) {
                dataMap.set(timestamp, { timestamp });
            }
        });
    });

    // Second pass: Populate the map with data from all sources
    allRawDataSources.forEach(source => {
        source.data.forEach((item: any) => {
            const timestamp = new Date(item.timestamp).getTime();
            if (isNaN(timestamp) || !dataMap.has(timestamp)) return;
            
            const point = dataMap.get(timestamp)!;

            if (source.type === 'file' && source.deployment) {
                const deployment = source.deployment;
                if (item.waterLevel !== undefined) {
                    const waterLevel = parseFloat(item.waterLevel.toString()) + parseFloat(deployment.sensorElevation.toString());
                    const rawWaterLevel = parseFloat(item.waterLevel.toString());
                    if(!isNaN(waterLevel)) point.waterLevel = waterLevel;
                    if(!isNaN(rawWaterLevel)) point.rawWaterLevel = rawWaterLevel;
                }
                if (item.sensorPressure !== undefined && !isNaN(parseFloat(item.sensorPressure.toString()))) point.sensorPressure = item.sensorPressure;
                if (item.temperature !== undefined && !isNaN(parseFloat(item.temperature.toString()))) point.temperature = item.temperature;
                if (item.barometer !== undefined && !isNaN(parseFloat(item.barometer.toString()))) point.barometer = item.barometer;
                if (item.precipitation !== undefined && !isNaN(parseFloat(item.precipitation.toString()))) point.precipitation = item.precipitation;
            } else if (source.type === 'surveys') {
                point.elevation = item.elevation;
            } else if (source.type === 'actions') {
                point.operationalAction = item.action;
                 if (point.waterLevel === undefined) {
                    // Try to find a nearby water level to plot against
                    const sortedDataForAction = Array.from(dataMap.values()).sort((a, b) => a.timestamp - b.timestamp);
                    const nearestSensorPoint = sortedDataForAction.filter(p => p.waterLevel !== undefined).reduce((prev, curr) => {
                       return (Math.abs(curr.timestamp - timestamp) < Math.abs(prev.timestamp - timestamp) ? curr : prev);
                    }, sortedDataForAction.find(p => p.waterLevel !== undefined) || sortedDataForAction[0]);
                    point.waterLevel = nearestSensorPoint?.waterLevel;
                }
            }
        });
    });
    
    let sortedData = Array.from(dataMap.values()).sort((a, b) => a.timestamp - b.timestamp);
    
    let processedEvents: AnalysisPeriod[] = [];
    const weatherSummary: WeatherSummary = { totalPrecipitation: 0, events: [] };

    // If we have data, fetch weather and process events
    if (sortedData.length > 0 && minDataDate && maxDataDate) {
        
        let weatherData: {timestamp: number, precipitation: number}[] = [];
        if (hasPrecipitationInData) {
            weatherData = sortedData
                .filter(d => d.precipitation !== undefined)
                .map(d => ({ timestamp: d.timestamp, precipitation: d.precipitation! }));
        } else {
             try {
                console.log(`Fetching weather data for ${asset.name} from ${minDataDate.toISOString()} to ${maxDataDate.toISOString()}`);
                const weatherCsv = await getWeatherData({
                    latitude: asset.latitude,
                    longitude: asset.longitude,
                    startDate: minDataDate.toISOString(),
                    endDate: maxDataDate.toISOString(),
                });

                if (weatherCsv) {
                     const parsedWeather = Papa.parse<{date: string, precipitation: string}>(weatherCsv, { header: true, skipEmptyLines: true });
                     weatherData = parsedWeather.data.map(row => ({
                         timestamp: new Date(row.date).getTime(),
                         precipitation: parseFloat(row.precipitation) || 0
                     })).filter(d => !isNaN(d.timestamp));
                    
                     // Merge weather data into main data points
                    weatherData.forEach(p => {
                        const existingPoint = sortedData.find(d => d.timestamp === p.timestamp);
                        if (existingPoint) {
                            existingPoint.precipitation = p.precipitation;
                        } else {
                            // Find the correct spot to insert the new point to maintain order
                            const index = sortedData.findIndex(d => d.timestamp > p.timestamp);
                            const newPoint: ChartablePoint = { timestamp: p.timestamp, precipitation: p.precipitation };
                            if (index === -1) {
                                sortedData.push(newPoint);
                            } else {
                                sortedData.splice(index, 0, newPoint);
                            }
                        }
                    });
                }

             } catch (error) {
                 console.error("Failed to fetch or process external weather data:", error);
             }
        }


        if (weatherData.length > 0) {
          const dailyPrecipitationMap = new Map<string, number>();
          weatherData.forEach(p => {
            const dateKey = new Date(p.timestamp).toISOString().split('T')[0];
            dailyPrecipitationMap.set(dateKey, (dailyPrecipitationMap.get(dateKey) || 0) + (p.precipitation || 0));
          });

          let sensorDataIndex = 0;
          weatherData.forEach(p => {
              if (sensorDataIndex >= sortedData.length) return;
              const weatherTimestamp = p.timestamp;
              const dateKey = new Date(p.timestamp).toISOString().split('T')[0];
              while (sensorDataIndex < sortedData.length - 1 && sortedData[sensorDataIndex + 1].timestamp <= weatherTimestamp) {
                  sensorDataIndex++;
              }
              if (sortedData[sensorDataIndex]) {
                  sortedData[sensorDataIndex].dailyPrecipitation = dailyPrecipitationMap.get(dateKey);
              }
          });

          // == Event Detection Logic ==
          let allSavedEvents: AnalysisPeriod[] = [];
          for (const deployment of assetDeployments) {
            const eventsFilePath = path.join(processedDir, deployment.id, 'events.json');
            const deploymentEvents = await readJsonFile<AnalysisPeriod[]>(eventsFilePath);
            allSavedEvents.push(...deploymentEvents);
          }

          const lastEventEndDate = allSavedEvents.length > 0 ? Math.max(...allSavedEvents.map(e => e.endDate)) : 0;
          
          const newDataToScanForEvents = weatherData.filter(p => p.timestamp > lastEventEndDate);
          
          let newEventsByDeployment: {[deploymentId: string]: AnalysisPeriod[]} = {};

          if(newDataToScanForEvents.length > 0) {
            const MEASURABLE_RAIN_THRESHOLD = 0.2; // mm
            const DRY_PERIOD_HOURS = 6;
            let currentEvent: AnalysisPeriod | null = null;
            let lastRainTimestamp: number | null = null;
            
            newDataToScanForEvents.forEach(p => {
                const currentTimestamp = p.timestamp;
                const precipitation = p.precipitation ?? 0;
                
                // Find which deployment this data point belongs to
                const relevantDeployment = assetDeployments.find(dep => 
                    dep.files?.some(f => new Date(f.startDate).getTime() <= currentTimestamp && new Date(f.endDate).getTime() >= currentTimestamp)
                );

                if (precipitation >= MEASURABLE_RAIN_THRESHOLD && relevantDeployment) {
                    if (currentEvent === null) {
                        currentEvent = { id: "", assetId: asset.id, deploymentId: relevantDeployment.id, startDate: currentTimestamp, endDate: currentTimestamp, totalPrecipitation: 0, dataPoints: [] };
                        if (!newEventsByDeployment[relevantDeployment.id]) {
                            newEventsByDeployment[relevantDeployment.id] = [];
                        }
                        newEventsByDeployment[relevantDeployment.id].push(currentEvent);
                    }
                    currentEvent.endDate = currentTimestamp;
                    currentEvent.totalPrecipitation += precipitation;
                    lastRainTimestamp = currentTimestamp;
                } else {
                    if (currentEvent && lastRainTimestamp) {
                         const hoursSinceLastRain = (currentTimestamp - lastRainTimestamp) / (1000 * 60 * 60);
                         if (hoursSinceLastRain >= DRY_PERIOD_HOURS) currentEvent = null;
                    }
                }
            });

            for (const [deploymentId, events] of Object.entries(newEventsByDeployment)) {
                const filteredEvents = events.filter(event => {
                    const durationSeconds = (event.endDate - event.startDate) / 1000;
                    return durationSeconds > 5 || event.totalPrecipitation >= 1;
                }).map(event => {
                    const assetName = asset.name.replace(/\s+/g, '');
                    const dateString = format(new Date(event.startDate), "yyyyMMddHHmm");
                    const precipString = Math.round(event.totalPrecipitation * 10) / 10;
                    return { ...event, id: `${assetName}-event${dateString}-${precipString}mm` };
                });
                
                if (filteredEvents.length > 0) {
                    const eventsFilePath = path.join(processedDir, deploymentId, 'events.json');
                    const existingEvents = await readJsonFile<AnalysisPeriod[]>(eventsFilePath);
                    const updatedEvents = [...existingEvents, ...filteredEvents.map(({ dataPoints, analysis, ...rest}) => rest)];
                    await writeJsonFile(eventsFilePath, updatedEvents);
                    allSavedEvents.push(...filteredEvents);
                }
            }
          }
          
          processedEvents = allSavedEvents;

          // == Analysis Logic for all events ==
          processedEvents.forEach(event => {
              weatherSummary.totalPrecipitation += event.totalPrecipitation;
              event.dataPoints = sortedData.filter(d => d.timestamp >= event.startDate && d.timestamp <= event.endDate);
              
              const analysis: AnalysisPeriod['analysis'] = event.analysis || {};
              analysis.marginOfError = 0.016; // meters for HOBO logger

              const baselineTime = event.startDate - (3 * 60 * 60 * 1000);
              const baselinePoints = sortedData.filter(p => p.timestamp <= baselineTime && p.waterLevel !== undefined);
              if (baselinePoints.length > 0) {
                 const baselinePoint = baselinePoints.reduce((prev, curr) => Math.abs(curr.timestamp - baselineTime) < Math.abs(prev.timestamp - baselineTime) ? curr : prev);
                 analysis.baselineElevation = baselinePoint?.waterLevel;
              }

              const peakWindowEnd = event.startDate + (48 * 60 * 60 * 1000);
              const peakPointsInWindow = sortedData.filter(p => p.timestamp >= event.startDate && p.timestamp <= peakWindowEnd && p.waterLevel !== undefined);
              if (peakPointsInWindow.length > 0) {
                const peakPoint = peakPointsInWindow.reduce((max, p) => p.waterLevel! > max.waterLevel! ? p : max, peakPointsInWindow[0]);
                analysis.peakElevation = peakPoint.waterLevel;
                analysis.peakTimestamp = peakPoint.timestamp;
              }
              
              const postEventTime = event.endDate + (48 * 60 * 60 * 1000);
              const postEventPoints = sortedData.filter(p => p.timestamp >= postEventTime && p.waterLevel !== undefined);
              if (postEventPoints.length > 0) {
                const postEventPoint = postEventPoints.reduce((prev, curr) => Math.abs(curr.timestamp - postEventTime) < Math.abs(prev.timestamp - postEventTime) ? curr : prev);
                analysis.postEventElevation = postEventPoint?.waterLevel;
              }

              if (analysis.peakTimestamp && analysis.baselineElevation) {
                  const returnPoint = sortedData.find(p => p.timestamp > analysis.peakTimestamp! && p.waterLevel !== undefined && p.waterLevel! <= analysis.baselineElevation!);
                  analysis.timeToBaseline = returnPoint ? formatDistance(new Date(analysis.peakTimestamp), new Date(returnPoint.timestamp)) : "Did not return to baseline";
              }

              analysis.drawdownAnalysis = "No interruption detected";
              if (analysis.peakTimestamp) {
                const postPeakPoints = sortedData.filter(p => p.timestamp > analysis.peakTimestamp! && p.waterLevel !== undefined);
                for (let i = 0; i < postPeakPoints.length; i++) {
                    const currentPoint = postPeakPoints[i];
                    const pointsInInterval = postPeakPoints.filter(p => p.timestamp >= currentPoint.timestamp && p.timestamp <= currentPoint.timestamp + (3 * 60 * 60 * 1000));
                    if (pointsInInterval.length < 2) continue;
                    const endPoint = pointsInInterval[pointsInInterval.length - 1];
                    if (endPoint.waterLevel! > currentPoint.waterLevel! + 0.01) {
                        const totalPrecipInInterval = pointsInInterval.reduce((sum, p) => sum + (p.precipitation || 0), 0);
                        if (totalPrecipInInterval < 0.2) {
                           analysis.drawdownAnalysis = `Interruption detected ${formatDistance(new Date(analysis.peakTimestamp!), new Date(currentPoint.timestamp))} after peak.`;
                           break;
                        }
                    }
                }
              }
              
              if (analysis.postEventElevation) analysis.estimatedTrueBaseline = analysis.postEventElevation;

              const savedEventAnalysis = savedAnalysis[event.id];
              if (savedEventAnalysis) {
                  analysis.notes = savedEventAnalysis.notes;
                  analysis.status = savedEventAnalysis.status;
                  analysis.analystInitials = savedEventAnalysis.analystInitials;
                  analysis.disregarded = savedEventAnalysis.disregarded;
              }

              event.analysis = analysis;
          });

          weatherSummary.events = processedEvents.sort((a,b) => b.startDate - a.startDate);
        }
    }
    
    const result = { data: sortedData, weatherSummary };
    return result;

  } catch (error) {
    console.error("Failed to get processed data:", error);
    return { data: [], weatherSummary: { totalPrecipitation: 0, events: [] } };
  }
}

export async function saveAnalysis(data: any) {
  const logPayload = { data };
  const validatedFields = saveAnalysisSchema.safeParse(data);
  if (!validatedFields.success) {
    const response = { errors: validatedFields.error.flatten().fieldErrors, message: 'Validation failed.' };
    await writeLog({ action: 'saveAnalysis', status: 'failure', payload: logPayload, response });
    return response;
  }

  const { eventId, notes, status, analystInitials, disregarded } = validatedFields.data;

  try {
    const allAnalysis = await readJsonFile<{[key: string]: SavedAnalysisData}>(analysisResultsFilePath);
    
    allAnalysis[eventId] = {
      notes,
      status,
      analystInitials,
      disregarded
    };

    await writeJsonFile(analysisResultsFilePath, allAnalysis);
    
    revalidatePath('/');

    const response = { message: 'Analysis saved successfully' };
    await writeLog({ action: 'saveAnalysis', status: 'success', payload: logPayload, response });
    return response;

  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    const response = { message: `Error: ${message}` };
    await writeLog({ action: 'saveAnalysis', status: 'failure', payload: logPayload, response });
    return response;
  }
}

export async function getOverallAnalysis(assetId: string): Promise<OverallAnalysisData | null> {
    try {
        const allAnalysis = await readJsonFile<{[key: string]: OverallAnalysisData}>(overallAnalysisFilePath);
        return allAnalysis[assetId] || null;
    } catch (error) {
        console.error(`Failed to get overall analysis for asset ${assetId}:`, error);
        return null;
    }
}

export async function saveOverallAnalysis(data: any) {
    const logPayload = { data };
    const validatedFields = saveOverallAnalysisSchema.safeParse(data);
    if (!validatedFields.success) {
        const response = { errors: validatedFields.error.flatten().fieldErrors, message: 'Validation failed.' };
        await writeLog({ action: 'saveOverallAnalysis', status: 'failure', payload: logPayload, response });
        return response;
    }
    
    const { assetId, ...analysisData } = validatedFields.data;
    
    try {
        const allAnalysis = await readJsonFile<{[key: string]: OverallAnalysisData}>(overallAnalysisFilePath);
        
        allAnalysis[assetId] = {
            ...allAnalysis[assetId],
            ...analysisData,
            assetId: assetId,
            lastUpdated: new Date().toISOString(),
        };

        await writeJsonFile(overallAnalysisFilePath, allAnalysis);

        // Also update the master asset status
        const assets = await readJsonFile<Asset[]>(assetsFilePath);
        const assetIndex = assets.findIndex(a => a.id === assetId);
        if (assetIndex !== -1) {
            const statusMap = {
                "Operating As Expected": "operating_as_expected",
                "Minor Concerns": "minor_concerns",
                "Critical Concerns": "critical_concerns",
            };
            assets[assetIndex].status = statusMap[analysisData.status as keyof typeof statusMap] || 'unknown';
            await writeJsonFile(assetsFilePath, assets);
        }
        
        revalidatePath('/');

        const response = { message: 'Overall analysis saved successfully', savedData: allAnalysis[assetId] };
        await writeLog({ action: 'saveOverallAnalysis', status: 'success', assetId, payload: logPayload, response });
        return response;

    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        const response = { message: `Error: ${message}` };
        await writeLog({ action: 'saveOverallAnalysis', status: 'failure', payload: logPayload, response });
        return response;
    }
}


export async function downloadLogs(assetId: string): Promise<{logs?: string, message?: string}> {
  try {
    const logs = await readJsonFile<ActivityLog[]>(activityLogFilePath);
    const assetLogs = logs.filter(log => log.assetId === assetId);

    if (assetLogs.length === 0) {
      return { logs: "No logs found for this asset.", message: "No logs found for this asset." };
    }

    const logString = assetLogs.map(log => {
      return `[${log.timestamp}] - [${log.status.toUpperCase()}] - Action: ${log.action}
Payload: ${JSON.stringify(log.payload, null, 2)}
Response: ${JSON.stringify(log.response, null, 2)}
----------------------------------------------------`;
    }).join('\n\n');

    return { logs: logString };

  } catch (error) {
    console.error('Failed to download logs:', error);
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    return { message: `Error: ${message}` };
  }
}

export async function createDeployment(assetId: string, data: any) {
  const logPayload = { assetId, data };
  const validatedFields = deploymentFormSchema.safeParse(data);
  if (!validatedFields.success) {
    const response = { errors: validatedFields.error.flatten().fieldErrors, message: 'Validation failed.' };
    await writeLog({ action: 'createDeployment', status: 'failure', assetId, payload: logPayload, response });
    return response;
  }
  const validatedData = validatedFields.data;

  try {
    let deployments: Deployment[] = await readJsonFile(deploymentsFilePath);
    const newDeploymentId = `dep-${Date.now()}`;

    const newDeployment: Deployment = {
      id: newDeploymentId,
      assetId: assetId,
      sensorId: validatedData.sensorId,
      sensorElevation: parseFloat(validatedData.sensorElevation.toString()),
      stillwellTop: validatedData.stillwellTop ? parseFloat(validatedData.stillwellTop.toString()) : undefined,
      name: validatedData.name || `Deployment ${new Date().toLocaleDateString()}`,
      files: [],
    };

    deployments.push(newDeployment);
    await writeJsonFile(deploymentsFilePath, deployments);
    
    // Create the directory for the new deployment
    await fs.mkdir(path.join(processedDir, newDeploymentId), { recursive: true });

    revalidatePath('/');
    
    const response = {
      message: 'Deployment created successfully',
      newDeployment,
    };
    await writeLog({ action: 'createDeployment', status: 'success', assetId, payload: logPayload, response });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    const response = { message: `Error: ${message}` };
    await writeLog({ action: 'createDeployment', status: 'failure', assetId, payload: logPayload, response });
    console.error('Failed to create deployment:', error);
    return response;
  }
}

export async function updateDeployment(deploymentId: string, assetId: string, data: any) {
  const logPayload = { deploymentId, assetId, data };
  const validatedFields = editDeploymentSchema.safeParse(data);

  if (!validatedFields.success) {
    const response = { errors: validatedFields.error.flatten().fieldErrors, message: 'Validation failed.' };
    await writeLog({ action: 'updateDeployment', status: 'failure', assetId, deploymentId, payload: logPayload, response });
    return response;
  }
  
  try {
    let deployments: Deployment[] = await readJsonFile(deploymentsFilePath);
    const deploymentIndex = deployments.findIndex(d => d.id === deploymentId);
    if (deploymentIndex === -1) {
      const response = { message: 'Deployment not found.' };
      await writeLog({ action: 'updateDeployment', status: 'failure', assetId, deploymentId, payload: logPayload, response });
      return response;
    }

    deployments[deploymentIndex] = {
      ...deployments[deploymentIndex],
      name: validatedFields.data.name,
      sensorId: validatedFields.data.sensorId,
      sensorElevation: parseFloat(validatedFields.data.sensorElevation.toString()),
      stillwellTop: validatedFields.data.stillwellTop ? parseFloat(validatedFields.data.stillwellTop.toString()) : undefined,
    };
    
    await writeJsonFile(deploymentsFilePath, deployments);

    revalidatePath('/');
    
    const response = {
      message: 'Deployment updated successfully',
      updatedDeployment: deployments[deploymentIndex],
    };
    await writeLog({ action: 'updateDeployment', status: 'success', assetId, deploymentId, payload: logPayload, response });
    return response;

  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    const response = { message: `Error: ${message}` };
    await writeLog({ action: 'updateDeployment', status: 'failure', assetId, deploymentId, payload: logPayload, response });
    console.error('Failed to update deployment:', error);
    return response;
  }
}

export async function updateAsset(assetId: string, data: any) {
  const logPayload = { assetId, data };
  const validatedFields = editAssetFormSchema.safeParse(data);

  if (!validatedFields.success) {
    const response = {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Validation failed. Please check the fields.',
    };
    await writeLog({ action: 'updateAsset', status: 'failure', assetId, payload: logPayload, response });
    return response;
  }

  const validatedData = validatedFields.data;

  try {
    const assets: Asset[] = await readJsonFile<Asset[]>(assetsFilePath);
    const assetIndex = assets.findIndex(a => a.id === assetId);

    if (assetIndex === -1) {
      const response = { message: 'Asset not found.' };
      await writeLog({ action: 'updateAsset', status: 'failure', assetId, payload: logPayload, response });
      return response;
    }

    // Update the asset properties
    assets[assetIndex] = {
      ...assets[assetIndex],
      name: validatedData.name,
      location: validatedData.location,
      latitude: parseFloat(validatedData.latitude.toString()),
      longitude: parseFloat(validatedData.longitude.toString()),
      permanentPoolElevation: parseFloat(validatedData.permanentPoolElevation.toString()),
      designElevations: validatedData.designElevations.map(de => ({
          name: de.name,
          elevation: parseFloat(de.elevation.toString())
      })),
      imageId: validatedData.imageId || '',
    };
    
    await writeJsonFile(assetsFilePath, assets);

    revalidatePath('/');
    revalidatePath('/asset-management');

    const response = {
      message: 'Asset updated successfully',
      updatedAsset: assets[assetIndex],
    };
    await writeLog({ action: 'updateAsset', status: 'success', assetId, payload: logPayload, response });
    return response;

  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    const response = { message: `Error: ${message}` };
    await writeLog({ action: 'updateAsset', status: 'failure', assetId, payload: logPayload, response });
    console.error('Failed to update asset:', error);
    return response;

  }
}


// The main server action
export async function createAsset(data: any) {
  const logPayload = { data };
  const validatedFields = assetFormSchema.safeParse(data);

  if (!validatedFields.success) {
    const response = {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Validation failed. Please check the fields.',
    };
    await writeLog({ action: 'createAsset', status: 'failure', payload: logPayload, response });
    return response;
  }
  
  const validatedData = validatedFields.data;

  try {
    const assets: Asset[] = await readJsonFile<Asset[]>(assetsFilePath);
    const newAssetId = `asset-${Date.now()}`;
    const newAsset: Asset = {
      id: newAssetId,
      name: validatedData.name,
      location: validatedData.location,
      latitude: parseFloat(validatedData.latitude.toString()),
      longitude: parseFloat(validatedData.longitude.toString()),
      permanentPoolElevation: parseFloat(validatedData.permanentPoolElevation.toString()),
      designElevations: validatedData.designElevations.map(de => ({
          name: de.name,
          elevation: parseFloat(de.elevation.toString())
      })),
      status: 'unknown', 
      imageId: validatedData.imageId || '',
    };
    
    assets.push(newAsset);
    await writeJsonFile(assetsFilePath, assets);

    revalidatePath('/');
    revalidatePath('/asset-management');

    const response = {
        message: 'Asset created successfully',
        newAsset,
    };
    await writeLog({ action: 'createAsset', status: 'success', assetId: newAssetId, payload: logPayload, response });
    return response;

  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred during asset creation.";
    const response = { message: `Error: ${message}` };
    await writeLog({ action: 'createAsset', status: 'failure', payload: logPayload, response });
    console.error('Failed to create asset:', error);
    return response;
  }
}

export async function deleteAsset(assetId: string) {
  const logPayload = { assetId };

  try {
    const assets: Asset[] = await readJsonFile<Asset[]>(assetsFilePath);
    const deployments: Deployment[] = await readJsonFile<Deployment[]>(deploymentsFilePath);
    
    const assetIndex = assets.findIndex(a => a.id === assetId);
    if (assetIndex === -1) {
      const response = { message: 'Asset not found.' };
      await writeLog({ action: 'deleteAsset', status: 'failure', assetId, payload: logPayload, response });
      return response;
    }

    // Find deployments associated with the asset
    const deploymentsToDelete = deployments.filter(d => d.assetId === assetId);

    // Delete associated processed data directories for each deployment
    for (const deployment of deploymentsToDelete) {
      const deploymentDir = path.join(processedDir, deployment.id);
      try {
        await fs.rm(deploymentDir, { recursive: true, force: true });
      } catch (error) {
         if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            console.error(`Failed to delete processed directory ${deploymentDir}:`, error);
         }
      }
    }
    
    // Filter out the asset and its deployments
    const updatedAssets = assets.filter(a => a.id !== assetId);
    const updatedDeployments = deployments.filter(d => d.assetId !== assetId);
    
    // Write the updated data back to the files
    await writeJsonFile(assetsFilePath, updatedAssets);
    await writeJsonFile(deploymentsFilePath, updatedDeployments);

    revalidatePath('/');
    revalidatePath('/asset-management');

    const response = { message: 'Asset and associated data deleted successfully.' };
    await writeLog({ action: 'deleteAsset', status: 'success', assetId, payload: logPayload, response });
    return response;

  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    const response = { message: `Error: ${message}` };
    await writeLog({ action: 'deleteAsset', status: 'failure', assetId, payload: logPayload, response });
    console.error('Failed to delete asset:', error);
    return response;
  }
}
