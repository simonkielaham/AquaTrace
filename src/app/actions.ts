
'use server';

import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import Papa from 'papaparse';
import { Asset, Deployment, DataPoint, DataFile } from '@/lib/placeholder-data';

// Define paths to data files
const dataDir = path.join(process.cwd(), 'data');
const assetsFilePath = path.join(dataDir, 'assets.json');
const deploymentsFilePath = path.join(dataDir, 'deployments.json');
const performanceDataFilePath = path.join(dataDir, 'performance-data.json');
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
  sensorId: z.string().min(1),
  datetimeColumn: z.string().min(1),
  waterLevelColumn: z.string().min(1),
  sensorElevation: z.coerce.number().min(0),
  startRow: z.coerce.number().min(1),
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

const editDeploymentSchema = z.object({
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
      if (filePath.endsWith('s.json')) return [] as T;
      if (filePath.endsWith('-data.json')) return {} as T;
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

export async function deleteAsset(assetId: string) {
  try {
    let assets: Asset[] = await readJsonFile(assetsFilePath);
    let deployments: Deployment[] = await readJsonFile(deploymentsFilePath);
    let performanceData: { [key: string]: DataPoint[] } = await readJsonFile(performanceDataFilePath);

    const assetIndex = assets.findIndex(a => a.id === assetId);
    if (assetIndex === -1) {
      return { message: 'Asset not found.' };
    }

    // Filter out the asset
    const updatedAssets = assets.filter(a => a.id !== assetId);
    
    // Filter out deployments associated with the asset
    const updatedDeployments = deployments.filter(d => d.assetId !== assetId);

    // Delete performance data for the asset
    if (performanceData[assetId]) {
      delete performanceData[assetId];
    }
    
    // Note: This does not delete uploaded CSV files from the /data/uploads directory
    // as their paths are not currently stored in the data model.

    await writeJsonFile(assetsFilePath, updatedAssets);
    await writeJsonFile(deploymentsFilePath, updatedDeployments);
    await writeJsonFile(performanceDataFilePath, performanceData);

    revalidatePath('/');
    revalidatePath('/asset-management');

    return {
      message: 'Asset deleted successfully',
      deletedAssetId: assetId
    };

  } catch (error) {
    console.error('Failed to delete asset:', error);
    return { message: `An error occurred: ${(error as Error).message}` };
  }
}

export async function addDatafile(deploymentId: string, data: any, formData: FormData) {
  const validatedFields = addDatafileSchema.safeParse(data);
  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors, message: 'Validation failed.' };
  }
  const validatedData = validatedFields.data;

  const file = formData.get('csvFile') as File | null;
  const fileContent = formData.get('csvContent') as string | null;

  if (!file || !fileContent) {
    return { message: 'CSV file is required.' };
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
      return { message: "Deployment not found." };
    }
    const deployment = deployments[deploymentIndex];

    const parsedCsv = Papa.parse(fileContent, { header: true, skipEmptyLines: true });
    const dataRows = (parsedCsv.data as any[]).slice(validatedData.startRow - 1);
    
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
    
    return {
      message: 'Datafile added successfully',
      updatedDeployment: deployment,
      newDataPoints: processedData,
    };

  } catch (error) {
    console.error('Failed to add datafile:', error);
    return { message: `An error occurred: ${(error as Error).message}` };
  }
}

export async function updateDeployment(deploymentId: string, data: any) {
  const validatedFields = editDeploymentSchema.safeParse(data);
  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors, message: 'Validation failed.' };
  }
  
  try {
    let deployments: Deployment[] = await readJsonFile(deploymentsFilePath);
    const deploymentIndex = deployments.findIndex(d => d.id === deploymentId);
    if (deploymentIndex === -1) {
      return { message: 'Deployment not found.' };
    }

    deployments[deploymentIndex] = {
      ...deployments[deploymentIndex],
      ...validatedFields.data,
    };
    
    await writeJsonFile(deploymentsFilePath, deployments);

    revalidatePath('/');
    
    return {
      message: 'Deployment updated successfully',
      updatedDeployment: deployments[deploymentIndex],
    };
  } catch (error) {
    console.error('Failed to update deployment:', error);
    return { message: `An error occurred: ${(error as Error).message}` };
  }
}

export async function updateAsset(assetId: string, data: any) {
  const validatedFields = editAssetFormSchema.safeParse(data);

  if (!validatedFields.success) {
    console.error('Validation Errors:', validatedFields.error.flatten().fieldErrors);
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Validation failed. Please check the fields.',
    };
  }

  const validatedData = validatedFields.data;

  try {
    const assets: Asset[] = await readJsonFile<Asset[]>(assetsFilePath);
    const assetIndex = assets.findIndex(a => a.id === assetId);

    if (assetIndex === -1) {
      return { message: 'Asset not found.' };
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

    return {
      message: 'Asset updated successfully',
      updatedAsset: assets[assetIndex],
    };

  } catch (error) {
    console.error('Failed to update asset:', error);
    return { message: `An error occurred: ${(error as Error).message}` };
  }
}


// The main server action
export async function createAsset(data: any, formData: FormData) {
  const validatedFields = assetFormSchema.safeParse(data);
  
  if (!validatedFields.success) {
    console.error('Validation Errors:', validatedFields.error.flatten().fieldErrors);
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Validation failed. Please check the fields.',
    };
  }
  
  const validatedData = validatedFields.data;
  const file = formData.get('csvFile') as File | null;
  const fileContent = formData.get('csvContent') as string | null;

  if (!file || !fileContent) {
    return { message: 'CSV file is required.' };
  }

  try {
    // 1. Save the uploaded CSV file
    await fs.mkdir(uploadsDir, { recursive: true });
    const uniqueFileName = `${Date.now()}-${file.name}`;
    const filePath = path.join(uploadsDir, uniqueFileName);
    const csvBuffer = Buffer.from(fileContent);
    await fs.writeFile(filePath, csvBuffer);

    // 2. Read existing data
    const assets: Asset[] = await readJsonFile<Asset[]>(assetsFilePath);
    let deployments: Deployment[] = await readJsonFile<Deployment[]>(deploymentsFilePath);
    const performanceData: { [key: string]: DataPoint[] } = await readJsonFile(performanceDataFilePath);

    // 3. Process CSV and create performance data
    const parsedCsv = Papa.parse(fileContent, { header: true, skipEmptyLines: true });
    const allRows = (parsedCsv.data as any[]);
    const dataRows = allRows.slice(validatedData.startRow - 1);
    
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    const processedData = dataRows
      .map(row => {
        const timeValue = row[validatedData.datetimeColumn];
        const waterLevelValue = parseFloat(row[validatedData.waterLevelColumn]);
        
        if (timeValue === undefined || isNaN(waterLevelValue)) {
            return null;
        }
        
        const date = new Date(timeValue);
        if (isNaN(date.getTime())) {
            return null;
        }

        if (!minDate || date < minDate) minDate = date;
        if (!maxDate || date > maxDate) maxDate = date;
        
        const waterElevation = waterLevelValue + validatedData.sensorElevation;

        return {
          time: date.toISOString(),
          waterLevel: waterLevelValue,
          waterElevation: waterElevation,
          precipitation: 0,
        };
      }).filter((dp): dp is DataPoint => dp !== null);
      
    // 4. Create or update asset, deployment, and file records
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

    const newDeploymentId = `dep-${Date.now()}`;
    const newDataFileId = `file-${Date.now()}`;

    const newDataFile: DataFile = {
      id: newDataFileId,
      deploymentId: newDeploymentId,
      fileName: file.name,
      startDate: minDate?.toISOString() || new Date().toISOString(),
      endDate: maxDate?.toISOString() || new Date().toISOString(),
    };
    
    const newDeployment: Deployment = {
      id: newDeploymentId,
      assetId: newAssetId,
      sensorId: validatedData.sensorId,
      sensorElevation: validatedData.sensorElevation,
      files: [newDataFile],
    };

    // 5. Append new data and write back to files
    assets.push(newAsset);
    deployments.push(newDeployment);
    performanceData[newAssetId] = processedData;

    await writeJsonFile(assetsFilePath, assets);
    await writeJsonFile(deploymentsFilePath, deployments);
    await writeJsonFile(performanceDataFilePath, performanceData);

    // Revalidate paths to trigger data refetch on the client
    revalidatePath('/');
    revalidatePath('/asset-management');

    // Return the new data so the client-side state can be updated without a full reload
    return {
        message: 'Asset created successfully',
        newAsset,
        newDeployment,
        newPerformanceData: { [newAssetId]: processedData }
    };

  } catch (error) {
    console.error('Failed to create asset:', error);
    return { message: `An error occurred: ${(error as Error).message}` };
  }
}
