
'use server';

import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { Asset, Deployment, ActivityLog, DataFile, DataPoint, StagedFile } from '@/lib/placeholder-data';
import Papa from 'papaparse';

// Define paths to data files
const dataDir = path.join(process.cwd(), 'data');
const assetsFilePath = path.join(dataDir, 'assets.json');
const deploymentsFilePath = path.join(dataDir, 'deployments.json');
const activityLogFilePath = path.join(dataDir, 'activity-log.json');
const stagedDir = path.join(dataDir, 'staged');
const processedDir = path.join(dataDir, 'processed');


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
    datetimeColumn: formData.get('datetimeColumn'),
    waterLevelColumn: formData.get('waterLevelColumn'),
    startRow: formData.get('startRow'),
  };
  const logPayload = { assetId, deploymentId, filename, ...rawData };

  const addDatafileSchema = z.object({
    datetimeColumn: z.string(),
    waterLevelColumn: z.string(),
    startRow: z.coerce.number().min(1),
  });

  const validatedFields = addDatafileSchema.safeParse(rawData);
  if (!validatedFields.success) {
     const response = { errors: validatedFields.error.flatten().fieldErrors, message: 'Validation failed.' };
     await writeLog({ action: 'assignDatafile', status: 'failure', payload: logPayload, response });
     return response;
  }
  const { datetimeColumn, waterLevelColumn, startRow } = validatedFields.data;

  const stagedFilePath = path.join(stagedDir, filename);

  try {
    const fileContent = await fs.readFile(stagedFilePath, 'utf-8');
    
    const parsedCsv = await new Promise<Papa.ParseResult<any>>((resolve, reject) => {
        Papa.parse(fileContent, {
            header: true,
            skipEmptyLines: true,
            preview: startRow - 1, // Read a few lines to find headers
            complete: (results: Papa.ParseResult<any>) => {
                const headerRow = results.meta.fields;
                if (!headerRow) {
                    return reject(new Error("Could not determine headers."));
                }
                // Now parse the full file with correct headers
                Papa.parse(fileContent, {
                    header: true,
                    skipEmptyLines: true,
                    // Papa's `header` detection is smart, but we need to tell it where data starts
                    // by effectively skipping rows before the data.
                    // This is tricky. Let's just parse the whole thing and slice.
                    complete: (fullResults: Papa.ParseResult<any>) => {
                      resolve(fullResults);
                    }
                });
            }
        });
    });

    const dataRows = (parsedCsv.data as any[]).slice(startRow - 1);

    const processedData = dataRows.map(row => {
        const dateValue = row[datetimeColumn];
        const levelValue = row[waterLevelColumn];
        
        if (dateValue && (levelValue !== null && levelValue !== undefined)) {
            const timestamp = new Date(dateValue);
            const waterLevel = parseFloat(levelValue);

            if (!isNaN(timestamp.getTime()) && !isNaN(waterLevel)) {
                return { timestamp, waterLevel };
            }
        }
        return null;
    }).filter(p => p !== null);

    if (processedData.length === 0) {
      throw new Error("No valid data points could be processed. Check column mapping and start row.");
    }
    
    const timestamps = processedData.map(p => p!.timestamp.getTime());
    const minDate = new Date(Math.min(...timestamps));
    const maxDate = new Date(Math.max(...timestamps));

    const newDataFile: DataFile = {
      id: `file-${Date.now()}`,
      filename: filename,
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

export async function getProcessedData(assetId: string): Promise<DataPoint[]> {
  try {
    const deployments = await readJsonFile<Deployment[]>(deploymentsFilePath);
    const assetDeployments = deployments.filter(d => d.assetId === assetId);

    let allData: DataPoint[] = [];

    for (const deployment of assetDeployments) {
      if (deployment.files) {
        for (const file of deployment.files) {
          const filePath = path.join(processedDir, `${file.id}.json`);
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
    
    const uniqueData = new Map<number, DataPoint>();
    allData.forEach(dp => {
      const timestamp = new Date(dp.timestamp);
      uniqueData.set(timestamp.getTime(), { ...dp, timestamp });
    });

    const sortedData = Array.from(uniqueData.values()).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    return sortedData;

  } catch (error) {
    console.error("Failed to get processed data:", error);
    return [];
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
