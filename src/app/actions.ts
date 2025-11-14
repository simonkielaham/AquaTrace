
'use server';

import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import Papa from 'papaparse';
import { Asset, Deployment, DataPoint } from '@/lib/placeholder-data';

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
  datetimeColumn: z.string().min(1),
  waterLevelColumn: z.string().min(1),
  sensorElevation: z.coerce.number().min(0),
  startRow: z.coerce.number().min(1),
});

// Helper function to read and parse a JSON file
async function readJsonFile<T>(filePath: string): Promise<T> {
  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // If the file doesn't exist, return a default value based on the file type
      if (filePath.endsWith('s.json')) return [] as T; // For assets, deployments (arrays)
      if (filePath.endsWith('-data.json')) return {} as T; // For performance data (object)
    }
    throw error;
  }
}

// Helper function to write to a JSON file
async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}


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
    // Ensure data directories exist
    await fs.mkdir(uploadsDir, { recursive: true });

    // 1. Save the uploaded CSV file
    const uniqueFileName = `${Date.now()}-${file.name}`;
    const filePath = path.join(uploadsDir, uniqueFileName);
    const csvBuffer = Buffer.from(fileContent);
    await fs.writeFile(filePath, csvBuffer);

    // 2. Read existing data
    const assets: Asset[] = await readJsonFile<Asset[]>(assetsFilePath);
    const deployments: Deployment[] = await readJsonFile<Deployment[]>(deploymentsFilePath);
    const performanceData: { [key: string]: DataPoint[] } = await readJsonFile(performanceDataFilePath);

    // 3. Create new asset and deployment records
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

    const newDeployment: Deployment = {
      id: `dep-${Date.now()}`,
      assetId: newAssetId,
      sensorId: `SN-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      startDate: new Date().toISOString(),
      endDate: null,
      fileName: file.name,
      fileCount: 1,
      sensorElevation: validatedData.sensorElevation,
    };
    
    // 4. Process CSV and create performance data
    const parsedCsv = Papa.parse(fileContent, { header: true, skipEmptyLines: true });
    const processedData = (parsedCsv.data as any[])
      .slice(validatedData.startRow - 1)
      .map(row => {
        const timeValue = row[validatedData.datetimeColumn];
        const waterLevelValue = parseFloat(row[validatedData.waterLevelColumn]);
        const waterElevation = waterLevelValue + validatedData.sensorElevation;
        return {
          time: new Date(timeValue).toISOString(),
          waterLevel: waterLevelValue,
          waterElevation: waterElevation,
          precipitation: 0,
        };
      }).filter(dp => !isNaN(dp.waterLevel) && dp.time && new Date(dp.time).getTime() > 0);


    // 5. Append new data and write back to files
    assets.push(newAsset);
    deployments.push(newDeployment);
    performanceData[newAssetId] = processedData;

    await writeJsonFile(assetsFilePath, assets);
    await writeJsonFile(deploymentsFilePath, deployments);
    await writeJsonFile(performanceDataFilePath, performanceData);

  } catch (error) {
    console.error('Failed to create asset:', error);
    return { message: `An error occurred: ${(error as Error).message}` };
  }
  
  // Revalidate paths to reflect changes and redirect
  revalidatePath('/');
  revalidatePath('/asset-management');
  redirect('/'); 
}
