
"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { 
  Asset, 
  Deployment,
  DataFile,
  DataPoint,
} from '@/lib/placeholder-data';
import { 
  createAsset as createAssetAction, 
  updateAsset as updateAssetAction, 
  updateDeployment as updateDeploymentAction, 
  addDatafile as addDatafileAction, 
  createDeployment as createDeploymentAction, 
  downloadLogs as downloadLogsAction,
  getProcessedData
} from '@/app/actions';

import initialAssets from '@/../data/assets.json';
import initialDeployments from '@/../data/deployments.json';

interface AssetContextType {
  assets: Asset[];
  selectedAssetId: string;
  setSelectedAssetId: (id: string) => void;
  deployments: Deployment[];
  performanceData: { [assetId: string]: DataPoint[] };
  createAsset: (data: any) => Promise<any>;
  updateAsset: (assetId: string, data: any) => Promise<any>;
  updateDeployment: (deploymentId: string, assetId: string, data: any) => Promise<any>;
  addDatafile: (deploymentId: string, assetId: string, data: any, formData: FormData) => Promise<any>;
  deleteAsset: (assetId: string) => Promise<any>;
  createDeployment: (assetId: string, data: any) => Promise<any>;
  downloadLogs: (assetId: string) => Promise<any>;
  loading: boolean;
}

const AssetContext = createContext<AssetContextType | undefined>(undefined);

const getErrorMessage = async (error: any): Promise<string> => {
    if (error instanceof Error) {
        return error.message;
    }
    if (error instanceof Response) {
        try {
            const text = await error.text();
            const match = text.match(/<div class="message">([^<]+)<\/div>/);
            if (match && match[1]) {
                return `Server Error: ${match[1]}`;
            }
            return `An unexpected response was received from the server. Raw response: \n\n${text}`;
        } catch (e) {
            return "An unexpected and unreadable response was received from the server.";
        }
    }
    if (typeof error === 'object' && error !== null) {
        try {
            return `An unexpected error object was received: ${JSON.stringify(error, null, 2)}`;
        } catch {}
    }
    return "An unknown error occurred.";
};


export const AssetProvider = ({ children }: { children: ReactNode }) => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [performanceData, setPerformanceData] = useState<{ [assetId: string]: DataPoint[] }>({});
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setAssets(initialAssets);
    setDeployments(initialDeployments);
    
    if (initialAssets.length > 0) {
      const storedAssetId = localStorage.getItem('selectedAssetId');
      const assetExists = initialAssets.some(a => a.id === storedAssetId);
      const targetAssetId = storedAssetId && assetExists ? storedAssetId : initialAssets[0].id;
      setSelectedAssetId(targetAssetId);
    }
    setLoading(false);
  }, []);

  // Effect to load performance data when assets or deployments change
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      const allData: { [assetId: string]: DataPoint[] } = {};

      for (const deployment of deployments) {
        if (!allData[deployment.assetId]) {
          allData[deployment.assetId] = [];
        }
        if (Array.isArray(deployment.files)) {
          for (const file of deployment.files) {
            const result = await getProcessedData(file.id);
            if (result.data && Array.isArray(result.data)) {
              allData[deployment.assetId].push(...result.data);
            } else if (result.message) {
              console.error(`Failed to load data for file ${file.id}: ${result.message}`);
            }
          }
        }
      }
      
      // Sort data for each asset
      for (const assetId in allData) {
        allData[assetId].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
      }
      
      setPerformanceData(allData);
      setLoading(false);
    };

    if (deployments.length > 0) {
      fetchAllData();
    }
  }, [deployments]);

  const handleSetSelectedAssetId = (id: string) => {
    localStorage.setItem('selectedAssetId', id);
    setSelectedAssetId(id);
  }

  const createAsset = useCallback(async (data: any) => {
    try {
      const result = await createAssetAction(data);
      if (result && !result.errors && result.newAsset) {
        setAssets(prev => [...prev, result.newAsset]);
      }
      return result;
    } catch (error) {
      const message = await getErrorMessage(error);
      return { message: `Error: ${message}` };
    }
  }, []);
  
  const createDeployment = useCallback(async (assetId: string, data: any) => {
    try {
      const result = await createDeploymentAction(assetId, data);
      if (result && !result.errors && result.newDeployment) {
        setDeployments(prev => [...prev, result.newDeployment]);
      }
      return result;
    } catch (error) {
       const message = await getErrorMessage(error);
       return { message: `Error: ${message}` };
    }
  }, []);

  const updateAsset = useCallback(async (assetId: string, data: any) => {
    try {
      const result = await updateAssetAction(assetId, data);
      if (result && !result.errors && result.updatedAsset) {
        setAssets(prev => prev.map(a => a.id === assetId ? result.updatedAsset : a));
      }
      return result;
    } catch (error) {
       const message = await getErrorMessage(error);
       return { message: `Error: ${message}` };
    }
  }, []);

  const updateDeployment = useCallback(async (deploymentId: string, assetId: string, data: any) => {
    try {
      const result = await updateDeploymentAction(deploymentId, assetId, data);
      if (result && !result.errors && result.updatedDeployment) {
        setDeployments(prev => prev.map(d => d.id === deploymentId ? result.updatedDeployment : d));
      }
      return result;
    } catch (error) {
       const message = await getErrorMessage(error);
       return { message: `Error: ${message}` };
    }
  }, []);

  const addDatafile = useCallback(async (deploymentId: string, assetId: string, data: any, formData: FormData) => {
    try {
      const result = await addDatafileAction(deploymentId, assetId, data, formData);
      if (result && !result.errors && result.updatedDeployment) {
        setDeployments(prev => prev.map(d => d.id === deploymentId ? result.updatedDeployment : d));
      }
      return result;
    } catch (error) {
      const message = await getErrorMessage(error);
      return { message: `Error: ${message}` };
    }
  }, []);
  
  const deleteAsset = useCallback(async (assetId: string) => {
    console.warn("deleteAsset is currently disabled.");
    return { message: "Asset deletion is temporarily disabled for safety."}
  }, []);

  const downloadLogs = useCallback(async (assetId: string) => {
    try {
      return await downloadLogsAction(assetId);
    } catch (error) {
      const message = await getErrorMessage(error);
      return { message: `Error: ${message}` };
    }
  }, []);


  const value = {
    assets,
    selectedAssetId,
    setSelectedAssetId: handleSetSelectedAssetId,
    deployments,
    performanceData,
    createAsset,
    updateAsset,
    updateDeployment,
    addDatafile,
    deleteAsset,
    createDeployment,
    downloadLogs,
    loading,
  };

  return (
    <AssetContext.Provider value={value}>
      {children}
    </AssetContext.Provider>
  );
};

export const useAssets = () => {
  const context = useContext(AssetContext);
  if (context === undefined) {
    throw new Error('useAssets must be used within an AssetProvider');
  }
  return context;
};
