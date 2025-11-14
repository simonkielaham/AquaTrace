
"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { 
  assets as initialAssets, 
  deployments as initialDeployments, 
  Asset, 
  Deployment 
} from '@/lib/placeholder-data';

interface AssetContextType {
  assets: Asset[];
  addAsset: (asset: Asset) => void;
  selectedAssetId: string;
  setSelectedAssetId: (id: string) => void;
  deployments: Deployment[];
  addDeployment: (deployment: Deployment) => void;
}

const AssetContext = createContext<AssetContextType | undefined>(undefined);

export const AssetProvider = ({ children }: { children: ReactNode }) => {
  const [assets, setAssets] = useState<Asset[]>(initialAssets);
  const [deployments, setDeployments] = useState<Deployment[]>(initialDeployments);
  const [selectedAssetId, setSelectedAssetId] = useState<string>(initialAssets.length > 0 ? initialAssets[0].id : '');

  const addAsset = (asset: Asset) => {
    setAssets(prevAssets => [...prevAssets, asset]);
  };

  const addDeployment = (deployment: Deployment) => {
    setDeployments(prevDeployments => [...prevDeployments, deployment]);
  };

  return (
    <AssetContext.Provider value={{ assets, addAsset, selectedAssetId, setSelectedAssetId, deployments, addDeployment }}>
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
