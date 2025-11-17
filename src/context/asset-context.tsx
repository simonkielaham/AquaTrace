
"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { 
  Asset, 
  Deployment,
  DataPoint,
} from '@/lib/placeholder-data';
import { createAsset as createAssetAction, updateAsset as updateAssetAction, updateDeployment as updateDeploymentAction, addDatafile as addDatafileAction, deleteAsset as deleteAssetAction } from '@/app/actions';

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
  createAsset: (data: any, formData: FormData) => Promise<any>;
  updateAsset: (assetId: string, data: any) => Promise<any>;
  updateDeployment: (deploymentId: string, data: any) => Promise<any>;
  addDatafile: (deploymentId: string, data: any, formData: FormData) => Promise<any>;
  deleteAsset: (assetId: string) => Promise<any>;
  loading: boolean;
}

const AssetContext = createContext<AssetContextType | undefined>(undefined);

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

  const createAsset = useCallback(async (data: any, formData: FormData) => {
    const result = await createAssetAction(data, formData);
    
    if (result && !result.errors) {
      if (result.newAsset && result.newDeployment && result.newPerformanceData) {
        const newAsset = result.newAsset;
        const newDeployment = result.newDeployment;
        
        setAssets(prev => [...prev, newAsset]);
        setDeployments(prev => [...prev, newDeployment]);
        setPerformanceData(prev => ({
          ...prev,
          ...result.newPerformanceData
        }));

        setSelectedAssetId(newAsset.id);
      }
    }
    return result;
  }, []);

  const updateAsset = useCallback(async (assetId: string, data: any) => {
    const result = await updateAssetAction(assetId, data);
    
    if (result && !result.errors) {
      if(result.updatedAsset) {
        setAssets(prev => prev.map(a => a.id === assetId ? result.updatedAsset : a));
      }
    }
    return result;
  }, []);

  const updateDeployment = useCallback(async (deploymentId: string, data: any) => {
    const result = await updateDeploymentAction(deploymentId, data);
    if (result && !result.errors && result.updatedDeployment) {
      setDeployments(prev => prev.map(d => d.id === deploymentId ? result.updatedDeployment : d));
    }
    return result;
  }, []);

  const addDatafile = useCallback(async (deploymentId: string, data: any, formData: FormData) => {
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
  }, []);
  
  const deleteAsset = useCallback(async (assetId: string) => {
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
