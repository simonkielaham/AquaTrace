
"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { 
  Asset, 
  Deployment,
  DataPoint,
} from '@/lib/placeholder-data';
import { createAsset as createAssetAction } from '@/app/actions';

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
  loading: boolean;
}

const AssetContext = createContext<AssetContextType | undefined>(undefined);

export const AssetProvider = ({ children }: { children: ReactNode }) => {
  const [assets, setAssets] = useState<Asset[]>(initialAssets);
  const [deployments, setDeployments] = useState<Deployment[]>(initialDeployments);
  const [performanceData, setPerformanceData] = useState<{ [assetId: string]: DataPoint[] }>(initialPerformanceData);
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
      // The action was successful, now update the client-side state
      // The server action returns the new state
      if (result.newAsset && result.newDeployment && result.newPerformanceData) {
        const newAsset = result.newAsset;
        const newDeployment = result.newDeployment;
        
        setAssets(prev => [...prev, newAsset]);
        // Since a new asset always creates one new deployment, we just add it.
        setDeployments(prev => [...prev, newDeployment]);

        setPerformanceData(prev => ({
          ...prev,
          ...result.newPerformanceData
        }));

        // Optionally select the new asset
        setSelectedAssetId(newAsset.id);
      }
    }
    return result;
  }, []);


  const value = {
    assets,
    selectedAssetId,
    setSelectedAssetId,
    deployments,
    performanceData,
    createAsset,
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
