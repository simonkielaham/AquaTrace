
"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { 
  Asset, 
  Deployment,
  DataPoint,
} from '@/lib/placeholder-data';
import { createAsset as createAssetAction, updateAsset as updateAssetAction, updateDeployment as updateDeploymentAction, addDatafile as addDatafileAction, deleteAsset as deleteAssetAction, createDeployment as createDeploymentAction } from '@/app/actions';

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
  updateDeployment: (deploymentId: string, data: any) => Promise<any>;
  addDatafile: (deploymentId: string, data: any, formData: FormData) => Promise<any>;
  deleteAsset: (assetId: string) => Promise<any>;
  createDeployment: (assetId: string, data: any) => Promise<any>;
  loading: boolean;
}

const AssetContext = createContext<AssetContextType | undefined>(undefined);

// Helper to get detailed error messages
const getErrorMessage = async (error: any): Promise<string> => {
    if (error instanceof Error) {
        return error.message;
    }
    // This is the crucial part for server action errors.
    // When a server action crashes, Next.js returns a Response object
    // with the HTML of the error page as the body.
    if (error instanceof Response) {
        const text = await error.text();
        return `An unexpected response was received from the server. This usually indicates a server-side crash. The server sent the following response:\n\n${text}`;
    }
    // Fallback for other unexpected error types
    if (typeof error === 'object' && error !== null) {
        try {
            return `An unexpected error object was received: ${JSON.stringify(error, null, 2)}`;
        } catch {
            // Ignore if not stringifiable
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
    // In a real app, you might fetch this data. For now, we load it from the imported JSON.
    // This structure prepares for async data loading.
    setAssets(initialAssets);
    setDeployments(initialDeployments);
    setPerformanceData(initialPerformanceData);
    
    if (initialAssets.length > 0) {
      setSelectedAssetId(initialAssets[0].id);
    }
    setLoading(false);
  }, []);

  const createAsset = useCallback(async (data: any) => {
    try {
      const result = await createAssetAction(data);
      
      if (result && !result.errors && result.newAsset) {
        setAssets(prev => [...prev, result.newAsset]);
        setSelectedAssetId(result.newAsset.id);
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

  const updateDeployment = useCallback(async (deploymentId: string, data: any) => {
    try {
      const result = await updateDeploymentAction(deploymentId, data);
      if (result && !result.errors && result.updatedDeployment) {
        setDeployments(prev => prev.map(d => d.id === deploymentId ? result.updatedDeployment : d));
      }
      return result;
    } catch (error) {
       const message = await getErrorMessage(error);
       return { message: `Error: ${message}` };
    }
  }, []);

  const addDatafile = useCallback(async (deploymentId: string, data: any, formData: FormData) => {
    try {
      const result = await addDatafileAction(deploymentId, data, formData);
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
    try {
      const result = await deleteAssetAction(assetId);
      if (result && !result.errors) {
        const remainingAssets = assets.filter(a => a.id !== assetId);
        setAssets(remainingAssets);
        setDeployments(prev => prev.filter(d => d.assetId !== assetId));
        setPerformanceData(prev => {
          const newState = { ...prev };
          delete newState[assetId];
          return newState;
        });

        // If the deleted asset was the selected one, select the first available asset
        if (selectedAssetId === assetId) {
            if (remainingAssets.length > 0) {
                setSelectedAssetId(remainingAssets[0].id);
            } else {
                setSelectedAssetId('');
            }
        }
      }
      return result;
    } catch (error) {
       const message = await getErrorMessage(error);
       return { message: `Error: ${message}` };
    }
  }, [assets, selectedAssetId]);


  const value = {
    assets,
    selectedAssetId,
    setSelectedAssetId,
    deployments,
    performanceData,
    createAsset,
    updateAsset,
    updateDeployment,
    addDatafile,
    deleteAsset,
    createDeployment,
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
