
"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { 
  Asset, 
  Deployment,
  DataPoint,
  StagedFile
} from '@/lib/placeholder-data';
import { 
  createAsset as createAssetAction, 
  updateAsset as updateAssetAction, 
  updateDeployment as updateDeploymentAction, 
  createDeployment as createDeploymentAction, 
  downloadLogs as downloadLogsAction,
  deleteAsset as deleteAssetAction,
  assignDatafileToDeployment as assignDatafileToDeploymentAction,
  getProcessedData as getProcessedDataAction,
  uploadStagedFile as uploadStagedFileAction,
  getStagedFiles as getStagedFilesAction,
  deleteStagedFile as deleteStagedFileAction,
  getStagedFileContent as getStagedFileContentAction,
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
  assignDatafileToDeployment: (formData: FormData) => Promise<any>;
  getProcessedData: (assetId: string) => Promise<DataPoint[]>;
  loading: boolean;
  stagedFiles: StagedFile[];
  loadingStagedFiles: boolean;
  uploadStagedFile: (formData: FormData) => Promise<any>;
  deleteStagedFile: (filename: string) => Promise<any>;
  getStagedFileContent: (filename: string) => Promise<string | null>;
}

const AssetContext = createContext<AssetContextType | undefined>(undefined);

const getErrorMessage = async (error: any): Promise<string> => {
    if (error instanceof Response) {
        try {
            const text = await error.text();
            const match = text.match(/<pre>.*(Error: .*?)<\/pre>/s);
            if (match && match[1]) {
                return `Server Error: ${match[1].replace(/<[^>]+>/g, '')}`;
            }
             // Attempt to find a different error format if the first fails
            const titleMatch = text.match(/<title>(.*?)<\/title>/s);
            if (titleMatch && titleMatch[1]) {
                 return `Server Error: ${titleMatch[1]}`;
            }
            return `An unexpected response was received from the server. Status: ${error.status}`;
        } catch (e) {
            return 'The server returned an unreadable error response.'
        }
    }
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'object' && error !== null) {
      try {
        const errorString = JSON.stringify(error, Object.getOwnPropertyNames(error));
        return `An unexpected error occurred: ${errorString}`;
      } catch (e) {
         return 'An unknown, non-serializable error occurred.';
      }
    }
    return 'An unknown error occurred.';
};


export const AssetProvider = ({ children }: { children: ReactNode }) => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [loadingStagedFiles, setLoadingStagedFiles] = useState(true);

  const fetchStagedFiles = useCallback(async () => {
    setLoadingStagedFiles(true);
    try {
      const files = await getStagedFilesAction();
      setStagedFiles(files);
    } catch (error) {
      console.error("Failed to fetch staged files:", error);
    } finally {
      setLoadingStagedFiles(false);
    }
  }, []);

  useEffect(() => {
    setAssets(initialAssets);
    setDeployments(initialDeployments);
    fetchStagedFiles();
    
    if (initialAssets.length > 0) {
      const storedAssetId = localStorage.getItem('selectedAssetId');
      const assetExists = initialAssets.some(a => a.id === storedAssetId);
      const targetAssetId = storedAssetId && assetExists ? storedAssetId : initialAssets[0].id;
      setSelectedAssetId(targetAssetId);
    }
    setLoading(false);
  }, [fetchStagedFiles]);


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
    try {
      const result = await deleteAssetAction(assetId);
      if (result && result.message.startsWith('Error:')) {
        return result;
      }
      
      setAssets(prev => prev.filter(a => a.id !== assetId));
      setDeployments(prev => prev.filter(d => d.assetId !== assetId));

      if (selectedAssetId === assetId) {
        const remainingAssets = assets.filter(a => a.id !== assetId);
        if (remainingAssets.length > 0) {
          handleSetSelectedAssetId(remainingAssets[0].id);
        } else {
          handleSetSelectedAssetId('');
        }
      }
      
      return { message: 'Asset deleted successfully.' };

    } catch (error) {
      const message = await getErrorMessage(error);
      return { message: `Error: ${message}` };
    }
  }, [assets, selectedAssetId]);

  const downloadLogs = useCallback(async (assetId: string) => {
    try {
      return await downloadLogsAction(assetId);
    } catch (error) {
      const message = await getErrorMessage(error);
      return { message: `Error: ${message}` };
    }
  }, []);

  const assignDatafileToDeployment = useCallback(async (formData: FormData) => {
    try {
      const result = await assignDatafileToDeploymentAction(formData);
      if (result.newFile) {
        const deploymentId = formData.get('deploymentId') as string;
        setDeployments(prev => prev.map(d => {
          if (d.id === deploymentId) {
            const updatedFiles = [...(d.files || []), result.newFile];
            return { ...d, files: updatedFiles };
          }
          return d;
        }));
        await fetchStagedFiles(); // Refresh staged files list
      }
      return result;
    } catch (error) {
       const message = await getErrorMessage(error);
       return { message: `Error: ${message}` };
    }
  }, [fetchStagedFiles]);

  const uploadStagedFile = useCallback(async (formData: FormData) => {
    try {
      const result = await uploadStagedFileAction(formData);
      if (!result.message.startsWith('Error:')) {
        await fetchStagedFiles();
      }
      return result;
    } catch (error) {
      const message = await getErrorMessage(error);
      return { message: `Error: ${message}` };
    }
  }, [fetchStagedFiles]);

  const deleteStagedFile = useCallback(async (filename: string) => {
    try {
      const result = await deleteStagedFileAction(filename);
      if (!result.message.startsWith('Error:')) {
        await fetchStagedFiles();
      }
      return result;
    } catch (error) {
      const message = await getErrorMessage(error);
      return { message: `Error: ${message}` };
    }
  }, [fetchStagedFiles]);

  const getProcessedData = useCallback(async (assetId: string): Promise<DataPoint[]> => {
    try {
      return await getProcessedDataAction(assetId);
    } catch (error) {
      console.error("Error fetching processed data in context:", error);
      return [];
    }
  }, []);

  const getStagedFileContent = useCallback(async (filename: string): Promise<string | null> => {
    try {
        return await getStagedFileContentAction(filename);
    } catch (error) {
        console.error("Error fetching staged file content in context:", error);
        return null;
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
    assignDatafileToDeployment,
    getProcessedData,
    loading,
    stagedFiles,
    loadingStagedFiles,
    uploadStagedFile,
    deleteStagedFile,
    getStagedFileContent
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

    