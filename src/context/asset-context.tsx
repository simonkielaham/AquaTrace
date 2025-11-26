
"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { 
  Asset, 
  Deployment,
  DataPoint,
  StagedFile,
  SurveyPoint,
  OperationalAction,
  SavedAnalysisData,
  OverallAnalysisData,
  WeatherSummary,
  ChartablePoint
} from '@/lib/placeholder-data';
import { 
  createAsset as createAssetAction, 
  updateAsset as updateAssetAction, 
  updateDeployment as updateDeploymentAction, 
  createDeployment as createDeploymentAction, 
  downloadLogs as downloadLogsAction,
  deleteAsset as deleteAssetAction,
  assignDatafileToDeployment as assignDatafileToDeploymentAction,
  reassignDatafile as reassignDatafileAction,
  uploadStagedFile as uploadStagedFileAction,
  getStagedFiles as getStagedFilesAction,
  deleteStagedFile as deleteStagedFileAction,
  getStagedFileContent as getStagedFileContentAction,
  getSourceFileContent as getSourceFileContentAction,
  addSurveyPoint as addSurveyPointAction,
  deleteSurveyPoint as deleteSurveyPointAction,
  getSurveyPoints as getSurveyPointsAction,
  addOperationalAction as addOperationalActionAction,
  deleteOperationalAction as deleteOperationalActionAction,
  getOperationalActions as getOperationalActionsAction,
  unassignDatafile as unassignDatafileAction,
  deleteDatafile as deleteDatafileAction,
  saveAnalysis as saveAnalysisAction,
  getProcessedData,
  getOverallAnalysis as getOverallAnalysisAction,
  saveOverallAnalysis as saveOverallAnalysisAction,
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
  reassignDatafile: (formData: FormData) => Promise<any>;
  unassignDatafile: (deploymentId: string, fileId: string) => Promise<any>;
  deleteDatafile: (deploymentId: string, fileId: string) => Promise<any>;
  saveAnalysis: (data: SavedAnalysisData & { eventId: string }) => Promise<any>;
  getOverallAnalysis: (assetId: string) => Promise<OverallAnalysisData | null>;
  saveOverallAnalysis: (data: any) => Promise<any>;
  loading: boolean;
  stagedFiles: StagedFile[];
  loadingStagedFiles: boolean;
  uploadStagedFile: (formData: FormData) => Promise<any>;
  deleteStagedFile: (filename: string) => Promise<any>;
  getStagedFileContent: (filename: string) => Promise<string | null>;
  getSourceFileContent: (filename: string) => Promise<string | null>;
  addSurveyPoint: (assetId: string, data: any) => Promise<any>;
  deleteSurveyPoint: (pointId: string) => Promise<any>;
  getSurveyPoints: (assetId: string) => Promise<SurveyPoint[]>;
  addOperationalAction: (assetId: string, data: any) => Promise<any>;
  deleteOperationalAction: (actionId: string) => Promise<any>;
  getOperationalActions: (assetId: string) => Promise<OperationalAction[]>;
  dataVersion: number;
  assetData: { [assetId: string]: { data: ChartablePoint[], weatherSummary: WeatherSummary | null, loading?: boolean } };
  fetchAssetData: (assetId: string) => Promise<void>;
  incrementDataVersion: () => void;
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
                 return `Server Error: ${titleMatch[1].replace(/<[^>]+>/g, '')}`;
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
  const [dataVersion, setDataVersion] = useState(0);
  const [assetData, setAssetData] = useState<AssetContextType['assetData']>({});


  const incrementDataVersion = useCallback(() => setDataVersion(v => v + 1), []);

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
  
  const fetchAssetData = useCallback(async (assetId: string) => {
    if (!assetId) return;
    setAssetData(prev => ({ ...prev, [assetId]: { ...(prev[assetId] || { data: [], weatherSummary: null }), loading: true } }));
    try {
        const result = await getProcessedData(assetId);
        setAssetData(prev => ({ ...prev, [assetId]: { data: result.data, weatherSummary: result.weatherSummary, loading: false } }));
    } catch (error) {
        console.error(`Failed to fetch data for asset ${assetId}:`, error);
        setAssetData(prev => ({ ...prev, [assetId]: { data: [], weatherSummary: null, loading: false } }));
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
        incrementDataVersion();
      }
      return result;
    } catch (error) {
      const message = await getErrorMessage(error);
      return { message: `Error: ${message}` };
    }
  }, [incrementDataVersion]);
  
  const createDeployment = useCallback(async (assetId: string, data: any) => {
    try {
      const result = await createDeploymentAction(assetId, data);
      if (result && !result.errors && result.newDeployment) {
        setDeployments(prev => [...prev, result.newDeployment]);
        incrementDataVersion();
      }
      return result;
    } catch (error) {
       const message = await getErrorMessage(error);
       return { message: `Error: ${message}` };
    }
  }, [incrementDataVersion]);

  const updateAsset = useCallback(async (assetId: string, data: any) => {
    try {
      const result = await updateAssetAction(assetId, data);
      if (result && !result.errors && result.updatedAsset) {
        setAssets(prev => prev.map(a => a.id === assetId ? result.updatedAsset : a));
        incrementDataVersion();
      }
      return result;
    } catch (error) {
       const message = await getErrorMessage(error);
       return { message: `Error: ${message}` };
    }
  }, [incrementDataVersion]);

  const updateDeployment = useCallback(async (deploymentId: string, assetId: string, data: any) => {
    try {
      const result = await updateDeploymentAction(deploymentId, assetId, data);
      if (result && !result.errors && result.updatedDeployment) {
        setDeployments(prev => prev.map(d => d.id === deploymentId ? result.updatedDeployment : d));
        incrementDataVersion();
      }
      return result;
    } catch (error) {
       const message = await getErrorMessage(error);
       return { message: `Error: ${message}` };
    }
  }, [incrementDataVersion]);

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
      incrementDataVersion();
      return { message: 'Asset deleted successfully.' };

    } catch (error) {
      const message = await getErrorMessage(error);
      return { message: `Error: ${message}` };
    }
  }, [assets, selectedAssetId, incrementDataVersion]);

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
        await fetchStagedFiles();
        incrementDataVersion();
      }
      return result;
    } catch (error) {
       const message = await getErrorMessage(error);
       return { message: `Error: ${message}` };
    }
  }, [fetchStagedFiles, incrementDataVersion]);

  const reassignDatafile = useCallback(async (formData: FormData) => {
      try {
          const result = await reassignDatafileAction(formData);
          if (result.updatedFile) {
              const deploymentId = formData.get('deploymentId') as string;
              setDeployments(prev => prev.map(d => {
                  if (d.id === deploymentId) {
                      const fileIndex = d.files?.findIndex(f => f.id === result.updatedFile.id);
                      if (fileIndex !== undefined && fileIndex !== -1) {
                          const newFiles = [...(d.files || [])];
                          newFiles[fileIndex] = result.updatedFile;
                          return { ...d, files: newFiles };
                      }
                  }
                  return d;
              }));
              incrementDataVersion();
          }
          return result;
      } catch (error) {
          const message = await getErrorMessage(error);
          return { message: `Error: ${message}` };
      }
  }, [incrementDataVersion]);

  const unassignDatafile = useCallback(async (deploymentId: string, fileId: string) => {
    try {
        const result = await unassignDatafileAction(deploymentId, fileId);
        if (!result.message.startsWith('Error:')) {
            setDeployments(prev => prev.map(d => {
                if (d.id === deploymentId) {
                    return { ...d, files: d.files?.filter(f => f.id !== fileId) };
                }
                return d;
            }));
            await fetchStagedFiles();
            incrementDataVersion();
        }
        return result;
    } catch (error) {
        const message = await getErrorMessage(error);
        return { message: `Error: ${message}` };
    }
  }, [fetchStagedFiles, incrementDataVersion]);

  const deleteDatafile = useCallback(async (deploymentId: string, fileId: string) => {
    try {
        const result = await deleteDatafileAction(deploymentId, fileId);
        if (!result.message.startsWith('Error:')) {
            setDeployments(prev => prev.map(d => {
                if (d.id === deploymentId) {
                    return { ...d, files: d.files?.filter(f => f.id !== fileId) };
                }
                return d;
            }));
            incrementDataVersion();
        }
        return result;
    } catch (error) {
        const message = await getErrorMessage(error);
        return { message: `Error: ${message}` };
    }
  }, [incrementDataVersion]);

  const saveAnalysis = useCallback(async (data: SavedAnalysisData & { eventId: string }) => {
    try {
      const result = await saveAnalysisAction(data);
      if (result && !result.errors) {
        setAssetData(prev => {
            const currentAsset = prev[selectedAssetId];
            if (!currentAsset || !currentAsset.weatherSummary) return prev;

            const updatedEvents = currentAsset.weatherSummary.events.map(event => {
                if (event.id === data.eventId) {
                    return {
                        ...event,
                        analysis: {
                            ...event.analysis,
                            notes: data.notes,
                            status: data.status,
                            analystInitials: data.analystInitials,
                            disregarded: data.disregarded,
                        }
                    };
                }
                return event;
            });

            return {
                ...prev,
                [selectedAssetId]: {
                    ...currentAsset,
                    weatherSummary: {
                        ...currentAsset.weatherSummary,
                        events: updatedEvents,
                    }
                }
            };
        });
      }
      return result;
    } catch (error) {
      const message = await getErrorMessage(error);
      return { message: `Error: ${message}` };
    }
  }, [selectedAssetId]);

  const getOverallAnalysis = useCallback(async (assetId: string) => {
      try {
          return await getOverallAnalysisAction(assetId);
      } catch (error) {
          console.error(error);
          return null;
      }
  }, []);

  const saveOverallAnalysis = useCallback(async (data: any) => {
    try {
      const result = await saveOverallAnalysisAction(data);
      if (result && !result.errors && result.savedData) {
        setAssets(prev => prev.map(a => a.id === result.savedData.assetId ? { ...a, status: result.savedData.status } : a));
        incrementDataVersion();
      }
      return result;
    } catch (error) {
       const message = await getErrorMessage(error);
       return { message: `Error: ${message}` };
    }
  }, [incrementDataVersion]);


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

  const getStagedFileContent = useCallback(async (filename: string) => {
    try {
      return await getStagedFileContentAction(filename);
    } catch (error) {
      const message = await getErrorMessage(error);
      console.error(message);
      return null;
    }
  }, []);
  
  const getSourceFileContent = useCallback(async (filename: string) => {
    try {
        return await getSourceFileContentAction(filename);
    } catch (error) {
      console.error(error);
      return null;
    }
  }, []);

  const addSurveyPoint = useCallback(async (assetId: string, data: any) => {
    try {
      const result = await addSurveyPointAction(assetId, data);
      if (result && !result.errors) {
        incrementDataVersion();
      }
      return result;
    } catch(error) {
        const message = await getErrorMessage(error);
        return { message: `Error: ${message}` };
    }
  }, [incrementDataVersion]);

  const deleteSurveyPoint = useCallback(async (pointId: string) => {
     try {
      const result = await deleteSurveyPointAction(pointId);
      if (result && !result.message.startsWith('Error:')) {
        incrementDataVersion();
      }
      return result;
    } catch(error) {
        const message = await getErrorMessage(error);
        return { message: `Error: ${message}` };
    }
  }, [incrementDataVersion]);

  const getSurveyPoints = useCallback(async (assetId: string) => {
    return await getSurveyPointsAction(assetId);
  }, []);
  
  const addOperationalAction = useCallback(async (assetId: string, data: any) => {
    try {
      const result = await addOperationalActionAction(assetId, data);
      if (result && !result.errors) {
        incrementDataVersion();
      }
      return result;
    } catch(error) {
        const message = await getErrorMessage(error);
        return { message: `Error: ${message}` };
    }
  }, [incrementDataVersion]);

  const deleteOperationalAction = useCallback(async (actionId: string) => {
     try {
      const result = await deleteOperationalActionAction(actionId);
      if (result && !result.message.startsWith('Error:')) {
        incrementDataVersion();
      }
      return result;
    } catch(error) {
        const message = await getErrorMessage(error);
        return { message: `Error: ${message}` };
    }
  }, [incrementDataVersion]);

  const getOperationalActions = useCallback(async (assetId: string) => {
    return await getOperationalActionsAction(assetId);
  }, []);


  const value = {
    assets,
    selectedAssetId,
    setSelectedAssetId: handleSetSelectedAssetId,
    deployments,
    createAsset,
    updateAsset,
    deleteAsset,
    createDeployment,
    updateDeployment,
    downloadLogs,
    assignDatafileToDeployment,
    reassignDatafile,
    unassignDatafile,
    deleteDatafile,
    saveAnalysis,
    getOverallAnalysis,
    saveOverallAnalysis,
    loading,
    stagedFiles,
    loadingStagedFiles,
    uploadStagedFile,
    deleteStagedFile,
    getStagedFileContent,
    getSourceFileContent,
    addSurveyPoint,
    deleteSurveyPoint,
    getSurveyPoints,
    addOperationalAction,
    deleteOperationalAction,
    getOperationalActions,
    dataVersion,
    assetData,
    fetchAssetData,
    incrementDataVersion,
  };

  return <AssetContext.Provider value={value}>{children}</AssetContext.Provider>;
};

export const useAssets = (): AssetContextType => {
  const context = useContext(AssetContext);
  if (context === undefined) {
    throw new Error('useAssets must be used within an AssetProvider');
  }
  return context;
};
