
"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { 
  Asset, 
  Deployment,
} from '@/lib/placeholder-data';
import { 
  createAsset as createAssetAction, 
  updateAsset as updateAssetAction, 
  updateDeployment as updateDeploymentAction, 
  createDeployment as createDeploymentAction, 
  downloadLogs as downloadLogsAction,
} from '@/app/actions';

import initialAssets from '@/../data/assets.json';
import initialDeployments from '@/../data/deployments.json';

interface AssetContextType {
  assets: Asset[];
  selectedAssetId: string;
  setSelectedAssetId: (id: string) => void;
  deployments: Deployment[];
  createAsset: (data: any) => Promise<any>;
  updateAsset: (assetId: string, data: any) => Promise<any>;
  updateDeployment: (deploymentId: string, assetId: string, data: any) => Promise<any>;
  deleteAsset: (assetId: string) => Promise<any>;
  createDeployment: (assetId: string, data: any) => Promise<any>;
  downloadLogs: (assetId: string) => Promise<any>;
  loading: boolean;
}

const AssetContext = createContext<AssetContextType | undefined>(undefined);

const getErrorMessage = async (error: any): Promise<string> => {
    console.error("Raw error object:", error);
    try {
        // Attempt to stringify the full error object to capture all details
        const errorString = JSON.stringify(error, Object.getOwnPropertyNames(error));
        return `SERVER RAW RESPONSE: ${errorString}`;
    } catch (e) {
        // Fallback for circular structures or other stringify errors
        if (error instanceof Error) {
            return `SERVER RAW RESPONSE (Fallback): ${error.message}\n${error.stack}`;
        }
        return "An unknown error occurred during error processing.";
    }
};


export const AssetProvider = ({ children }: { children: ReactNode }) => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
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
    createAsset,
    updateAsset,
    updateDeployment,
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
