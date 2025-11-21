

'use server';

import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { Asset, Deployment, ActivityLog, DataFile, DataPoint, StagedFile, SurveyPoint, ChartablePoint, AnalysisPeriod, WeatherSummary } from '@/lib/placeholder-data';
import Papa from 'papaparse';
import { getWeatherData } from '@/../sourceexamples/weather-service';


// Define paths to data files
const dataDir = path.join(process.cwd(), 'data');
const assetsFilePath = path.join(dataDir, 'assets.json');
const deploymentsFilePath = path.join(dataDir, 'deployments.json');
const activityLogFilePath = path.join(dataDir, 'activity-log.json');
const surveyPointsFilePath = path.join(dataDir, 'survey-points.json');
const stagedDir = path.join(process.cwd(), 'staged');
const processedDir = path.join(dataDir, 'processed');


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


// Helper function to read and parse a JSON file
async function readJsonFile<T>(filePath: string): Promise<T> {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const fileContent = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      if (filePath.endsWith('s.json') || filePath.endsWith('log.json') || filePath.endsWith('points.json')) return [] as T;
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

export async function assignDatafileToDeployment(formData: FormData) {
  const deploymentId = formData.get('deploymentId') as string;
  const assetId = formData.get('assetId') as string;
  const filename = formData.get('filename') as string;
  
  const rawData = {
    dataType: formData.get('dataType'),
    datetimeColumn: formData.get('datetimeColumn'),
    valueColumn: formData.get('valueColumn'),
    startRow: formData.get('startRow'),
  };
  const logPayload = { assetId, deploymentId, filename, ...rawData };

  const addDatafileSchema = z.object({
    dataType: z.enum(['water-level', 'precipitation']),
    datetimeColumn: z.string(),
    valueColumn: z.string(),
    startRow: z.coerce.number().min(1),
  });

  const validatedFields = addDatafileSchema.safeParse(rawData);
  if (!validatedFields.success) {
     const response = { errors: validatedFields.error.flatten().fieldErrors, message: 'Validation failed.' };
     await writeLog({ action: 'assignDatafile', status: 'failure', payload: logPayload, response });
     return response;
  }
  const { dataType, datetimeColumn, valueColumn, startRow } = validatedFields.data;

  const stagedFilePath = path.join(stagedDir, filename);

  try {
    const fileContent = await fs.readFile(stagedFilePath, 'utf-8');
    
    const parsedCsv = await new Promise<Papa.ParseResult<any>>((resolve, reject) => {
        Papa.parse(fileContent, {
            header: true,
            skipEmptyLines: true,
            complete: (results: Papa.ParseResult<any>) => {
              if (!results.meta.fields || results.meta.fields.length === 0) {
                 return reject(new Error("Could not determine headers from CSV."));
              }
              // Manually handle startRow logic
              const data = startRow > 1 ? results.data.slice(startRow - 2) : results.data;
              resolve({ ...results, data });
            },
        });
    });

    const processedData = parsedCsv.data.map((row: any) => {
        const dateValue = row[datetimeColumn];
        const val = row[valueColumn];
        
        if (dateValue && (val !== null && val !== undefined && val !== '')) {
            const timestamp = new Date(dateValue);
            const value = parseFloat(val);

            if (!isNaN(timestamp.getTime()) && !isNaN(value)) {
                return { timestamp: timestamp.toISOString(), value };
            }
        }
        return null;
    }).filter(p => p !== null) as { timestamp: string, value: number }[];

    if (processedData.length === 0) {
      throw new Error("No valid data points could be processed. Check column mapping and start row.");
    }
    
    const timestamps = processedData.map(p => new Date(p.timestamp).getTime());
    const minDate = new Date(Math.min(...timestamps));
    const maxDate = new Date(Math.max(...timestamps));

    const newDataFile: DataFile = {
      id: `file-${Date.now()}`,
      filename: filename,
      dataType: dataType,
      uploadDate: new Date().toISOString(),
      startDate: minDate.toISOString(),
      endDate: maxDate.toISOString(),
      rowCount: processedData.length
    };
    
    // Save processed data to a new file in the processed directory
    await fs.mkdir(processedDir, { recursive: true });
    const processedFilePath = path.join(processedDir, `${newDataFile.id}.json`);
    await writeJsonFile(processedFilePath, processedData);

    // Update the deployments file with the new datafile metadata
    const deployments = await readJsonFile<Deployment[]>(deploymentsFilePath);
    const deploymentIndex = deployments.findIndex(d => d.id === deploymentId);
    if (deploymentIndex === -1) throw new Error('Deployment not found');
    
    const existingFiles = deployments[deploymentIndex].files || [];
    deployments[deploymentIndex].files = [...existingFiles, newDataFile];
    
    await writeJsonFile(deploymentsFilePath, deployments);

    // Delete the file from staging
    await fs.unlink(stagedFilePath);

    revalidatePath('/');
    
    const response = { message: 'Datafile assigned successfully', newFile: newDataFile };
    await writeLog({ action: 'assignDatafile', status: 'success', payload: logPayload, response });
    return response;

  } catch(error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    const response = { message: `Error: ${message}` };
    await writeLog({ action: 'assignDatafile', status: 'failure', payload: logPayload, response });
    return response;
  }
}


export async function unassignDatafile(deploymentId: string, fileId: string) {
    const logPayload = { deploymentId, fileId };
    try {
        const deployments = await readJsonFile<Deployment[]>(deploymentsFilePath);
        const deploymentIndex = deployments.findIndex(d => d.id === deploymentId);

        if (deploymentIndex === -1) {
            throw new Error("Deployment not found.");
        }
        
        const deployment = deployments[deploymentIndex];
        const file = deployment.files?.find(f => f.id === fileId);
        
        if (!file) {
            throw new Error("Datafile not found in this deployment.");
        }

        // Remove file from deployment
        deployments[deploymentIndex].files = deployment.files?.filter(f => f.id !== fileId);
        await writeJsonFile(deploymentsFilePath, deployments);

        // Delete processed file
        const processedFilePath = path.join(processedDir, `${fileId}.json`);
        try {
            await fs.unlink(processedFilePath);
        } catch (e) {
            if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
                console.error(`Could not delete processed file ${processedFilePath}:`, e);
                // Continue even if file deletion fails to ensure metadata is updated
            }
        }
        
        revalidatePath('/');
        const response = { message: `File ${file.filename} unassigned successfully.` };
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
    // This action is identical to unassign for now, as unassign already deletes the processed file.
    // If "unassign" logic changes to move the file back to staging, this action will remain as a permanent delete.
    return await unassignDatafile(deploymentId, fileId);
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
    const assetDeployments = deployments.filter(d => d.assetId === assetId);

    const dataMap = new Map<number, ChartablePoint>();
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    // First pass: Collect all water level data and determine the date range
    for (const deployment of assetDeployments) {
      if (deployment.files) {
        for (const file of deployment.files) {
          if (file.dataType !== 'water-level') continue;

          const filePath = path.join(processedDir, `${file.id}.json`);
          try {
            const fileData = await readJsonFile<{ timestamp: string, value: number }[]>(filePath);
            
            fileData.forEach(d => {
                const timestamp = new Date(d.timestamp).getTime();
                if (isNaN(timestamp)) return;

                if (!minDate || timestamp < minDate.getTime()) minDate = new Date(timestamp);
                if (!maxDate || timestamp > maxDate.getTime()) maxDate = new Date(timestamp);

                if (!dataMap.has(timestamp)) {
                    dataMap.set(timestamp, { timestamp });
                }
                const point = dataMap.get(timestamp)!;
                
                const waterLevel = parseFloat(d.value.toString()) + parseFloat(deployment.sensorElevation.toString());
                const rawWaterLevel = parseFloat(d.value.toString());
                if(!isNaN(waterLevel)) {
                    point.waterLevel = waterLevel;
                }
                if(!isNaN(rawWaterLevel)) {
                    point.rawWaterLevel = rawWaterLevel;
                }
            });

          } catch (e) {
             if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
                console.error(`Could not read processed file ${file.id}.json:`, e);
             }
          }
        }
      }
    }

    // Second pass: merge survey points
    const sensorDataPoints = Array.from(dataMap.values());
    surveyPoints.forEach(sp => {
        // Find the nearest timestamp in the sensor data to align the survey point
        let nearestTimestamp = sp.timestamp;
        if (sensorDataPoints.length > 0) {
            const nearestSensorPoint = sensorDataPoints.reduce((prev, curr) => {
               return (Math.abs(curr.timestamp - sp.timestamp) < Math.abs(prev.timestamp - sp.timestamp) ? curr : prev);
            });
            nearestTimestamp = nearestSensorPoint.timestamp;
        }

        if (!dataMap.has(nearestTimestamp)) {
           dataMap.set(nearestTimestamp, { timestamp: nearestTimestamp });
        }
        const point = dataMap.get(nearestTimestamp)!;
        point.elevation = sp.elevation; // Add the manual elevation
      });

    
    const weatherSummary: WeatherSummary = { totalPrecipitation: 0, events: [] };
    const sortedData = Array.from(dataMap.values()).sort((a, b) => a.timestamp - b.timestamp);

    // If we have data, fetch and process weather data
    if (sortedData.length > 0 && minDate && maxDate) {
      try {
        const weatherCsv = await getWeatherData({
          latitude: asset.latitude,
          longitude: asset.longitude,
          startDate: minDate.toISOString(),
          endDate: maxDate.toISOString(),
        });

        if (weatherCsv) {
          const weatherData = Papa.parse(weatherCsv, { header: true, dynamicTyping: true }).data as {date: string, precipitation: number}[];
          
          const dailyPrecipitationMap = new Map<string, number>();
          weatherData.forEach(weatherPoint => {
            if (!weatherPoint.date) return;
            const dateKey = new Date(weatherPoint.date).toISOString().split('T')[0];
            const currentTotal = dailyPrecipitationMap.get(dateKey) || 0;
            dailyPrecipitationMap.set(dateKey, currentTotal + (weatherPoint.precipitation || 0));
          });


          let sensorDataIndex = 0;

          // Aggregate precipitation onto the chart data
          weatherData.forEach(weatherPoint => {
              if (!weatherPoint.date || sensorDataIndex >= sortedData.length) return;
              
              const weatherTimestamp = new Date(weatherPoint.date).getTime();
              const precipitation = weatherPoint.precipitation ?? 0;
              const dateKey = new Date(weatherPoint.date).toISOString().split('T')[0];

              // Find the correct sensor data "bucket" for this weather point
              while (
                  sensorDataIndex < sortedData.length - 1 &&
                  sortedData[sensorDataIndex + 1].timestamp <= weatherTimestamp
              ) {
                  sensorDataIndex++;
              }
              
              // Add precipitation to the current sensor data point
              if (sortedData[sensorDataIndex]) {
                  sortedData[sensorDataIndex].precipitation = (sortedData[sensorDataIndex].precipitation || 0) + precipitation;
                  sortedData[sensorDataIndex].dailyPrecipitation = dailyPrecipitationMap.get(dateKey);
              }
          });
          
          // Logic for precipitation event definition
          const MEASURABLE_RAIN_THRESHOLD = 0.2; // mm
          const DRY_PERIOD_HOURS = 6;
          let lastRainTimestamp: number | null = null;
          let currentEvent: AnalysisPeriod | null = null;
          
          weatherData.forEach(weatherPoint => {
              if (!weatherPoint.date) return;
              
              const currentTimestamp = new Date(weatherPoint.date).getTime();
              const precipitation = weatherPoint.precipitation ?? 0;
              
              if (precipitation >= MEASURABLE_RAIN_THRESHOLD) {
                  weatherSummary.totalPrecipitation += precipitation;
                  
                  if (currentEvent === null) {
                      // Start of a new event
                      currentEvent = {
                          id: `event-${currentTimestamp}`,
                          assetId: asset.id,
                          startDate: currentTimestamp,
                          endDate: currentTimestamp,
                          totalPrecipitation: 0,
                          dataPoints: []
                      };
                      weatherSummary.events.push(currentEvent);
                  }
                  
                  currentEvent.endDate = currentTimestamp;
                  currentEvent.totalPrecipitation += precipitation;

                  lastRainTimestamp = currentTimestamp;

              } else { // No measurable rain
                  if (currentEvent && lastRainTimestamp) {
                       const hoursSinceLastRain = (currentTimestamp - lastRainTimestamp) / (1000 * 60 * 60);
                       if (hoursSinceLastRain >= DRY_PERIOD_HOURS) {
                           // End the current event
                           currentEvent = null;
                       }
                  }
              }
          });

          // Finalize data for each event and filter out insignificant ones
          const significantEvents = weatherSummary.events.filter(event => {
            const durationSeconds = (event.endDate - event.startDate) / 1000;
            // Keep event if duration > 5 seconds OR precipitation >= 1mm
            return durationSeconds > 5 || event.totalPrecipitation >= 1;
          });
          weatherSummary.events = significantEvents;

          weatherSummary.events.forEach(event => {
              event.dataPoints = sortedData.filter(d => d.timestamp >= event.startDate && d.timestamp <= event.endDate);
              
              // New Analysis Logic
              const analysis: AnalysisPeriod['analysis'] = {};

              // 1. Baseline Elevation
              const baselineTime = event.startDate - (3 * 60 * 60 * 1000);
              const baselinePoint = sortedData.reduce((prev, curr) => 
                Math.abs(curr.timestamp - baselineTime) < Math.abs(prev.timestamp - baselineTime) ? curr : prev
              );
              analysis.baselineElevation = baselinePoint?.waterLevel;

              // 2. Peak Elevation
              const peakWindowEnd = event.startDate + (48 * 60 * 60 * 1000);
              const peakPoints = sortedData.filter(p => p.timestamp >= event.startDate && p.timestamp <= peakWindowEnd && p.waterLevel !== undefined);
              if (peakPoints.length > 0) {
                analysis.peakElevation = Math.max(...peakPoints.map(p => p.waterLevel!));
              }
              
              // 3. Post-Event Elevation
              const postEventTime = event.endDate + (48 * 60 * 60 * 1000);
              const postEventPoint = sortedData.reduce((prev, curr) =>
                 Math.abs(curr.timestamp - postEventTime) < Math.abs(prev.timestamp - postEventTime) ? curr : prev
              );
              analysis.postEventElevation = postEventPoint?.waterLevel;

              event.analysis = analysis;
          });
        }
      } catch (error) {
          console.error("Failed to get or process weather data:", error);
      }
    }
    
    return { data: sortedData, weatherSummary };

  } catch (error) {
    console.error("Failed to get processed data:", error);
    return { data: [], weatherSummary: { totalPrecipitation: 0, events: [] } };
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

    const newDeployment: Deployment = {
      id: `dep-${Date.now()}`,
      assetId: assetId,
      sensorId: validatedData.sensorId,
      sensorElevation: parseFloat(validatedData.sensorElevation.toString()),
      stillwellTop: validatedData.stillwellTop ? parseFloat(validatedData.stillwellTop.toString()) : undefined,
      name: validatedData.name || `Deployment ${new Date().toLocaleDateString()}`,
      files: [],
    };

    deployments.push(newDeployment);

    await writeJsonFile(deploymentsFilePath, deployments);
    
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
      status: 'ok', 
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

    // Delete associated processed data files
    for (const deployment of deploymentsToDelete) {
      if (deployment.files) {
        for (const file of deployment.files) {
          const filePath = path.join(processedDir, `${file.id}.json`);
          try {
            await fs.unlink(filePath);
          } catch (error) {
             if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                console.error(`Failed to delete processed file ${filePath}:`, error);
             }
          }
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

