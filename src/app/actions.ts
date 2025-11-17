
'use server';

import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import Papa from 'papaparse';
import { Asset, Deployment, DataPoint, DataFile, ActivityLog } from '@/lib/placeholder-data';

// Define paths to data files
const dataDir = path.join(process.cwd(), 'data');
const assetsFilePath = path.join(dataDir, 'assets.json');
const deploymentsFilePath = path.join(dataDir, 'deployments.json');
const performanceDataFilePath = path.join(dataDir, 'performance-data.json');
const activityLogFilePath = path.join(dataDir, 'activity-log.json');
const uploadsDir = path.join(dataDir, 'uploads');


// Define the schema for the form data
const assetFormSchema = z.object({
  name: z.string().min(2),
  location: z.string().min(2),
  permanentPoolElevation: z.coerce.number().min(0),
  designElevations: z.array(z.object({
    year: z.coerce.number(),
    elevation: z.coerce.number()
  })),
});

const editAssetFormSchema = z.object({
  name: z.string().min(2),
  location: z.string().min(2),
  permanentPoolElevation: z.coerce.number().min(0),
  designElevations: z.array(z.object({
    year: z.coerce.number(),
    elevation: z.coerce.number()
  })),
});

const deploymentFormSchema = z.object({
  sensorId: z.string().min(1),
  sensorElevation: z.coerce.number(),
  name: z.string().optional(),
});


const editDeploymentSchema = z.object({
  name: z.string().optional(),
  sensorId: z.string().min(1),
  sensorElevation: z.coerce.number(),
});

const addDatafileSchema = z.object({
  datetimeColumn: z.string().min(1),
  waterLevelColumn: z.string().min(1),
  startRow: z.coerce.number().min(1),
});


// Helper function to read and parse a JSON file
async function readJsonFile<T>(filePath: string): Promise<T> {
  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // If file doesn't exist, return a default empty state based on file name
      if (filePath.endsWith('s.json') || filePath.endsWith('log.json')) return [] as T;
      if (filePath.endsWith('-data.json')) return {} as T;
    }
    // For any other errors, or if the default empty state doesn't match, log and re-throw.
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
    // We don't throw here because logging failure should not fail the main operation
  }
}

export async function downloadLogs(assetId: string): Promise<{logs?: string, message?: string}> {
  try {
    const logs = await readJsonFile<ActivityLog[]>(activityLogFilePath);
    const assetLogs = logs.filter(log => log.assetId === assetId);

    if (assetLogs.length === 0) {
      return { logs: "No logs found for this asset.", message: "No logs found for this asset." };
    }

    // Format logs for download
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
  const validatedFields = deploymentFormSchema.safeParse(data);
  const logPayload = { assetId, data };
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
      sensorElevation: validatedData.sensorElevation,
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
    console.error('Failed to create deployment:', error);
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    const response = { message: `Error: ${message}` };
    await writeLog({ action: 'createDeployment', status: 'failure', assetId, payload: logPayload, response });
    return response;
  }
}

export async function addDatafile(deploymentId: string, assetId: string, data: any, formData: FormData) {
  const validatedFields = addDatafileSchema.safeParse(data);
  const logPayload = { deploymentId, assetId, data: { ...data, csvFileName: (formData.get('csvFile') as File)?.name } };
  
  if (!validatedFields.success) {
    const response = { errors: validatedFields.error.flatten().fieldErrors, message: 'Validation failed.' };
    await writeLog({ action: 'addDatafile', status: 'failure', assetId, deploymentId, payload: logPayload, response });
    return response;
  }
  const validatedData = validatedFields.data;

  const file = formData.get('csvFile') as File | null;
  const fileContent = formData.get('csvContent') as string | null;

  if (!file || !fileContent) {
    const response = { message: 'CSV file is required.' };
    await writeLog({ action: 'addDatafile', status: 'failure', assetId, deploymentId, payload: logPayload, response });
    return response;
  }

  try {
    await fs.mkdir(uploadsDir, { recursive: true });
    const uniqueFileName = `${Date.now()}-${file.name}`;
    const filePath = path.join(uploadsDir, uniqueFileName);
    await fs.writeFile(filePath, Buffer.from(fileContent));

    let deployments: Deployment[] = await readJsonFile(deploymentsFilePath);
    const performanceData: { [key: string]: DataPoint[] } = await readJsonFile(performanceDataFilePath);

    const deploymentIndex = deployments.findIndex(d => d.id === deploymentId);
    if (deploymentIndex === -1) {
      const response = { message: "Deployment not found." };
      await writeLog({ action: 'addDatafile', status: 'failure', assetId, deploymentId, payload: logPayload, response });
      return response;
    }
    const deployment = deployments[deploymentIndex];

    const parsedCsv = Papa.parse(fileContent, { header: true, skipEmptyLines: true });
    
    // The user provides a 1-based start row. Papa parse with `header:true` returns a 0-indexed array
    // of data rows. Subtract 2 to correctly handle 1-based vs 0-based indexing and the header row.
    const sliceIndex = Math.max(0, validatedData.startRow - 2);
    const dataRows = (parsedCsv.data as any[]).slice(sliceIndex);
    
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    const processedData = dataRows.map(row => {
        const timeValue = row[validatedData.datetimeColumn];
        const waterLevelValue = parseFloat(row[validatedData.waterLevelColumn]);
        if (!timeValue || isNaN(waterLevelValue)) return null;
        
        const date = new Date(timeValue);
        if (isNaN(date.getTime())) return null;

        if (!minDate || date < minDate) minDate = date;
        if (!maxDate || date > maxDate) maxDate = date;
        
        return {
          time: date.toISOString(),
          waterLevel: waterLevelValue,
          waterElevation: waterLevelValue + deployment.sensorElevation,
          precipitation: 0,
        };
      }).filter((dp): dp is DataPoint => dp !== null);

    if (processedData.length === 0) {
      throw new Error('No valid data points found in the CSV file after processing.');
    }

    const newDataFile: DataFile = {
      id: `file-${Date.now()}`,
      deploymentId: deploymentId,
      fileName: file.name,
      startDate: minDate?.toISOString() || new Date().toISOString(),
      endDate: maxDate?.toISOString() || new Date().toISOString(),
    };

    if (!deployment.files) deployment.files = [];
    deployment.files.push(newDataFile);

    const existingData = performanceData[deployment.assetId] || [];
    const combinedData = [...existingData, ...processedData];
    combinedData.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    performanceData[deployment.assetId] = combinedData;

    await writeJsonFile(deploymentsFilePath, deployments);
    await writeJsonFile(performanceDataFilePath, performanceData);

    revalidatePath('/');
    
    const response = {
      message: 'Datafile added successfully',
      updatedDeployment: deployment,
      updatedPerformanceData: { [deployment.assetId]: combinedData }
    };
    await writeLog({ action: 'addDatafile', status: 'success', assetId, deploymentId, payload: logPayload, response: { message: response.message } });
    return response;

  } catch (error) {
    console.error('Failed to add datafile:', error);
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    const response = { message: `Error: ${message}` };
    await writeLog({ action: 'addDatafile', status: 'failure', assetId, deploymentId, payload: logPayload, response });
    return response;
  }
}

export async function updateDeployment(deploymentId: string, assetId: string, data: any) {
  const validatedFields = editDeploymentSchema.safeParse(data);
  const logPayload = { deploymentId, assetId, data };

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
      ...validatedFields.data,
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
    console.error('Failed to update deployment:', error);
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    const response = { message: `Error: ${message}` };
    await writeLog({ action: 'updateDeployment', status: 'failure', assetId, deploymentId, payload: logPayload, response });
    return response;
  }
}

export async function updateAsset(assetId: string, data: any) {
  const validatedFields = editAssetFormSchema.safeParse(data);
  const logPayload = { assetId, data };

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
      permanentPoolElevation: validatedData.permanentPoolElevation,
      designElevations: validatedData.designElevations,
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
    console.error('Failed to update asset:', error);
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    const response = { message: `Error: ${message}` };
    await writeLog({ action: 'updateAsset', status: 'failure', assetId, payload: logPayload, response });
    return response;

  }
}


// The main server action
export async function createAsset(data: any) {
  const validatedFields = assetFormSchema.safeParse(data);
  const logPayload = { data };

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
    // 1. Read existing data
    const assets: Asset[] = await readJsonFile<Asset[]>(assetsFilePath);

    // 2. Create new asset record
    const newAssetId = `asset-${Date.now()}`;
    const newAsset: Asset = {
      id: newAssetId,
      name: validatedData.name,
      location: validatedData.location,
      permanentPoolElevation: validatedData.permanentPoolElevation,
      designElevations: validatedData.designElevations,
      status: 'ok', // Default status
      imageId: ['pond', 'basin', 'creek'][Math.floor(Math.random() * 3)],
    };
    
    // 3. Append new data and write back to file
    assets.push(newAsset);
    await writeJsonFile(assetsFilePath, assets);

    // Revalidate paths to trigger data refetch on the client
    revalidatePath('/');
    revalidatePath('/asset-management');

    const response = {
        message: 'Asset created successfully',
        newAsset,
    };
    await writeLog({ action: 'createAsset', status: 'success', assetId: newAssetId, payload: logPayload, response });
    return response;

  } catch (error) {
    console.error('Failed to create asset:', error);
    const message = error instanceof Error ? error.message : "An unknown error occurred during asset creation.";
    const response = { message: `Error: ${message}` };
    await writeLog({ action: 'createAsset', status: 'failure', payload: logPayload, response });
    return response;
  }
}
    
    

    