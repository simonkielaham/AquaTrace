
"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { 
  Asset, 
  Deployment,
  DataPoint,
  assets as initialAssets,
  deployments as initialDeployments,
  performanceData as initialPerformanceData,
} from '@/lib/placeholder-data';

interface AssetContextType {
  assets: Asset[];
  selectedAssetId: string;
  setSelectedAssetId: (id: string) => void;
  deployments: Deployment[];
  performanceData: { [assetId: string]: DataPoint[] };
}

const AssetContext = createContext<AssetContextType | undefined>(undefined);

export const AssetProvider = ({ children }: { children: ReactNode }) => {
  const [assets, setAssets] = useState<Asset[]>(initialAssets);
  const [deployments, setDeployments] = useState<Deployment[]>(initialDeployments);
  const [performanceData, setPerformanceData] = useState<{ [assetId: string]: DataPoint[] }>(initialPerformanceData);
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');

  useEffect(() => {
    // Set the initial selected asset ID once assets are loaded
    if (assets.length > 0 && !selectedAssetId) {
      setSelectedAssetId(assets[0].id);
    }
  }, [assets, selectedAssetId]);


  const value = {
    assets,
    selectedAssetId,
    setSelectedAssetId,
    deployments,
    performanceData,
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
