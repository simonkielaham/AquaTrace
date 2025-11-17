
"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { 
  Asset, 
  Deployment,
  DataPoint,
} from '@/lib/placeholder-data';
import { createAsset as createAssetAction, updateAsset as updateAssetAction, updateDeployment as updateDeploymentAction, addDatafile as addDatafileAction, createDeployment as createDeploymentAction, downloadLogs as downloadLogsAction } from '@/app/actions';

// We will fetch initial data from server actions or a dedicated API route in a real app
// For now, we start with empty arrays and let the effect load the data.
import initialAssets from '@/../data/assets.json';
import initialDeployments from '@/../data/deployments.json';
import initialPerformanceData from '@/../data/performance-data.json';


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
            // Attempt to find the core error message from a Next.js HTML error page
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
        } catch {
            // fallback if not stringifiable
        }
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
    setPerformanceData(initialPerformanceData);
    
    if (initialAssets.length > 0) {
      const storedAssetId = localStorage.getItem('selectedAssetId');
      if (storedAssetId && initialAssets.some(a => a.id === storedAssetId)) {
        setSelectedAssetId(storedAssetId);
      } else {
        setSelectedAssetId(initialAssets[0].id);
      }
    }
    setLoading(false);
  }, []);

  const handleSetSelectedAssetId = (id: string) => {
    localStorage.setItem('selectedAssetId', id);
    setSelectedAssetId(id);
  }

  const createAsset = useCallback(async (data: any) => {
    try {
      const result = await createAssetAction(data);
      
      if (result && !result.errors && result.newAsset) {
        setAssets(prev => [...prev, result.newAsset]);
        // Don't auto-select, let the user navigate
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
      
      if (result && !result.errors) {
        if(result.updatedAsset) {
          setAssets(prev => prev.map(a => a.id === assetId ? result.updatedAsset : a));
        }
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
      if (result && !result.errors && result.updatedDeployment && result.updatedPerformanceData) {
        const { updatedDeployment, updatedPerformanceData } = result;
        setDeployments(prev => prev.map(d => d.id === deploymentId ? updatedDeployment : d));
        setPerformanceData(prev => ({
          ...prev,
          ...updatedPerformanceData
        }));
      }
      return result;
    } catch (error) {
      const message = await getErrorMessage(error);
      return { message: `Error: ${message}` };
    }
  }, []);
  
  const deleteAsset = useCallback(async (assetId: string) => {
    // This function is temporarily disabled to prevent accidental data loss.
    // The UI button will still exist but the action it calls will do nothing.
    // In a real-world app, we'd want a more robust, possibly soft-delete, mechanism.
    console.warn("deleteAsset is currently disabled.");
    // This action would need to remove the asset, its deployments, and its performance data.
    // For now, we return a message. A real implementation would modify the JSON files.
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
