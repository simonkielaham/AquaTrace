
'use server';

import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { Asset, Deployment, ActivityLog, DataFile, DataPoint } from '@/lib/placeholder-data';
import Papa from 'papaparse';

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

export async function addDatafile(formData: FormData) {
  const deploymentId = formData.get('deploymentId') as string;
  const assetId = formData.get('assetId') as string;
  const file = formData.get('file') as File;
  const fileContent = formData.get('fileContent') as string;
  
  const rawData = {
    datetimeColumn: formData.get('datetimeColumn'),
    waterLevelColumn: formData.get('waterLevelColumn'),
    startRow: formData.get('startRow'),
  };
  const logPayload = { assetId, deploymentId, fileName: file.name, ...rawData };

  const addDatafileSchema = z.object({
    datetimeColumn: z.string(),
    waterLevelColumn: z.string(),
    startRow: z.coerce.number().min(1),
  });

  const validatedFields = addDatafileSchema.safeParse(rawData);
  if (!validatedFields.success) {
     const response = { errors: validatedFields.error.flatten().fieldErrors, message: 'Validation failed.' };
     await writeLog({ action: 'addDatafile', status: 'failure', assetId, deploymentId, payload: logPayload, response });
     return response;
  }
  const { datetimeColumn, waterLevelColumn, startRow } = validatedFields.data;

  try {
    const parsedCsv = Papa.parse(fileContent, { header: true, skipEmptyLines: true });
    
    // The data starts at the user-specified row. Since papaparse with header:true already consumes the first row,
    // and array is 0-indexed, we subtract 2 from the 1-based startRow.
    const sliceIndex = startRow >= 2 ? startRow - 2 : 0; 
    const dataRows = (parsedCsv.data as any[]).slice(sliceIndex);
    
    const processedData = dataRows.map(row => {
        const dateValue = row[datetimeColumn];
        const levelValue = row[waterLevelColumn];
        if (dateValue && levelValue) {
            return {
                timestamp: new Date(dateValue),
                waterLevel: parseFloat(levelValue),
            };
        }
        return null;
    }).filter(p => p && !isNaN(p.timestamp.getTime()) && !isNaN(p.waterLevel));

    if (processedData.length === 0) {
      throw new Error("No valid data points could be processed. Check column mapping and start row.");
    }
    
    const timestamps = processedData.map(p => p!.timestamp.getTime());
    const minDate = new Date(Math.min(...timestamps));
    const maxDate = new Date(Math.max(...timestamps));

    const newDataFile: DataFile = {
      id: `file-${Date.now()}`,
      filename: file.name,
      uploadDate: new Date().toISOString(),
      startDate: minDate.toISOString(),
      endDate: maxDate.toISOString(),
      rowCount: processedData.length
    };
    
    // Save processed data to a new file in the data/processed directory
    const processedDataDir = path.join(dataDir, 'processed');
    await fs.mkdir(processedDataDir, { recursive: true });
    const processedFilePath = path.join(processedDataDir, `${newDataFile.id}.json`);
    await writeJsonFile(processedFilePath, processedData);

    // Update the deployments file with the new datafile metadata
    const deployments = await readJsonFile<Deployment[]>(deploymentsFilePath);
    const deploymentIndex = deployments.findIndex(d => d.id === deploymentId);
    if (deploymentIndex === -1) throw new Error('Deployment not found');

    // ** THIS IS THE FIX **
    // Robustly update the files array by creating a new array
    // This avoids mutation issues with the object read from JSON.
    const existingFiles = deployments[deploymentIndex].files || [];
    deployments[deploymentIndex].files = [...existingFiles, newDataFile];
    
    await writeJsonFile(deploymentsFilePath, deployments);
    revalidatePath('/');
    
    const response = { message: 'Datafile added successfully', newFile: newDataFile };
    await writeLog({ action: 'addDatafile', status: 'success', assetId, deploymentId, payload: logPayload, response });
    return response;

  } catch(error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    const response = { message: `Error: ${message}` };
    await writeLog({ action: 'addDatafile', status: 'failure', assetId, deploymentId, payload: logPayload, response });
    return response;
  }
}

export async function getProcessedData(assetId: string): Promise<DataPoint[]> {
  try {
    const deployments = await readJsonFile<Deployment[]>(deploymentsFilePath);
    const assetDeployments = deployments.filter(d => d.assetId === assetId);

    let allData: DataPoint[] = [];

    for (const deployment of assetDeployments) {
      if (deployment.files) {
        for (const file of deployment.files) {
          const filePath = path.join(dataDir, 'processed', `${file.id}.json`);
          // It's possible the file doesn't exist yet, so we handle that case.
          try {
            const fileData = await readJsonFile<DataPoint[]>(filePath);
            allData = [...allData, ...fileData];
          } catch (e) {
             if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
                console.error(`Could not read processed file ${file.id}.json:`, e);
             }
          }
        }
      }
    }
    
    // De-duplicate data points based on timestamp
    const uniqueData = new Map<number, DataPoint>();
    allData.forEach(dp => {
      // Re-hydrate the timestamp string into a Date object if necessary
      const timestamp = new Date(dp.timestamp);
      uniqueData.set(timestamp.getTime(), { ...dp, timestamp });
    });

    const sortedData = Array.from(uniqueData.values()).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    return sortedData;

  } catch (error) {
    console.error("Failed to get processed data:", error);
    return []; // Return empty array on error
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
    const processedDataDir = path.join(dataDir, 'processed');
    for (const deployment of deploymentsToDelete) {
      if (deployment.files) {
        for (const file of deployment.files) {
          const filePath = path.join(processedDataDir, `${file.id}.json`);
          try {
            await fs.unlink(filePath);
          } catch (error) {
             if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                console.error(`Failed to delete processed file ${filePath}:`, error);
                // Decide if you want to throw an error or just log it
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
    
    

    

    



    

    

    

    



    