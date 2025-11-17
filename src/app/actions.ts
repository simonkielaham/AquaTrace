
'use server';

import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { Asset, Deployment, ActivityLog } from '@/lib/placeholder-data';

// Define paths to data files
const dataDir = path.join(process.cwd(), 'data');
const assetsFilePath = path.join(dataDir, 'assets.json');
const deploymentsFilePath = path.join(dataDir, 'deployments.json');
const activityLogFilePath = path.join(dataDir, 'activity-log.json');


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


// Helper function to read and parse a JSON file
async function readJsonFile<T>(filePath: string): Promise<T> {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const fileContent = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      if (filePath.endsWith('s.json') || filePath.endsWith('log.json')) return [] as T;
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
      sensorElevation: validatedData.sensorElevation,
      name: validatedData.name || `Deployment ${new Date().toLocaleDateString()}`,
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
      permanentPoolElevation: validatedData.permanentPoolElevation,
      designElevations: validatedData.designElevations,
      status: 'ok', 
      imageId: ['pond', 'basin', 'creek'][Math.floor(Math.random() * 3)],
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
    
    

    

    



    

    

    

    
