
"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
  assignDatafile as assignDatafileAction,
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
  getDeploymentAnalysis as getOverallAnalysisAction,
  getRawDeploymentAnalysisJson as getRawOverallAnalysisJsonAction,
  saveDeploymentAnalysis as saveOverallAnalysisAction,
  checkFileExists as checkFileExistsAction,
  getDeploymentDiagnostics,
  readJsonFile, // Import the server action for reading files
} from '@/app/actions';
import { assetFormSchema, AssetFormValues } from '@/components/asset-management/asset-form';

interface AssetData {
  data: ChartablePoint[];
  weatherSummary: WeatherSummary | null;
  overallAnalysis: OverallAnalysisData | null;
  surveyPoints: SurveyPoint[];
  operationalActions: OperationalAction[];
  diagnostics: any | null;
  loading?: boolean;
}
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
  assignDatafile: (formData: FormData) => Promise<any>;
  reassignDatafile: (formData: FormData) => Promise<any>;
  unassignDatafile: (deploymentId: string, fileId: string) => Promise<any>;
  deleteDatafile: (deploymentId: string, fileId: string) => Promise<any>;
  saveAnalysis: (data: SavedAnalysisData & { eventId: string }) => Promise<any>;
  getOverallAnalysis: (deploymentId: string) => Promise<OverallAnalysisData | null>;
  getRawOverallAnalysisJson: (deploymentId: string) => Promise<string>;
  saveOverallAnalysis: (data: any) => Promise<any>;
  checkFileExists: (filePath: string) => Promise<boolean>;
  loading: boolean;
  stagedFiles: StagedFile[];
  loadingStagedFiles: boolean;
  uploadStagedFile: (formData: FormData) => Promise<any>;
  deleteStagedFile: (filename: string) => Promise<any>;
  getStagedFileContent: (filename: string) => Promise<string | null>;
  getSourceFileContent: (filename: string) => Promise<string | null>;
  addSurveyPoint: (data: any) => Promise<any>;
  deleteSurveyPoint: (deploymentId: string, pointId: string) => Promise<any>;
  getSurveyPoints: (deploymentId: string) => Promise<SurveyPoint[]>;
  addOperationalAction: (data: any) => Promise<any>;
  deleteOperationalAction: (deploymentId: string, actionId: string) => Promise<any>;
  getOperationalActions: (deploymentId: string) => Promise<OperationalAction[]>;
  dataVersion: number;
  assetData: { [assetId: string]: AssetData };
  fetchAssetData: (assetId: string) => Promise<void>;
  incrementDataVersion: () => void;
  useAssetForm: (defaultValues?: Partial<AssetFormValues>) => ReturnType<typeof useForm<AssetFormValues>>;
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

    const initialData: AssetData = { data: [], weatherSummary: null, overallAnalysis: null, surveyPoints: [], operationalActions: [], diagnostics: null, loading: true };
    setAssetData(prev => ({ ...prev, [assetId]: { ...(prev[assetId] || initialData), loading: true } }));

    try {
        const currentDeployments = deployments.filter(d => d.assetId === assetId);
        
        const deploymentDataPromises = currentDeployments.map(async (deployment) => {
            const [
                processedDataResult, 
                overallAnalysisResult,
                surveyPointsResult,
                operationalActionsResult,
                diagnosticsResult
            ] = await Promise.all([
              getProcessedData(deployment.id),
              getOverallAnalysisAction(deployment.id),
              getSurveyPointsAction(deployment.id),
              getOperationalActionsAction(deployment.id),
              getDeploymentDiagnostics(deployment.id),
            ]);
            return {
                deploymentId: deployment.id,
                processedData: processedDataResult,
                overallAnalysis: overallAnalysisResult,
                surveyPoints: surveyPointsResult,
                operationalActions: operationalActionsResult,
                diagnostics: diagnosticsResult,
            };
        });
        
        const allDeploymentData = await Promise.all(deploymentDataPromises);
        
        // This merges data from all deployments. For simplicity, we'll take the first one's analysis
        // and combine chart data. This logic may need refinement based on UX choices.
        const combinedData: ChartablePoint[] = allDeploymentData.flatMap(d => d.processedData.data);
        const combinedSurveyPoints: SurveyPoint[] = allDeploymentData.flatMap(d => d.surveyPoints);
        const combinedOperationalActions: OperationalAction[] = allDeploymentData.flatMap(d => d.operationalActions);
        
        // Sorting all chartable points by timestamp
        combinedData.sort((a,b) => a.timestamp - b.timestamp);
        
        // For now, we take the weather and overall analysis from the first deployment if it exists
        const primaryDeploymentData = allDeploymentData[0];
        
        // Merge survey points and operational actions into the main chart data
        const surveyPointsMap = new Map(combinedSurveyPoints.map(p => [p.timestamp, p]));
        const operationalActionsMap = new Map(combinedOperationalActions.map(a => [a.timestamp, a]));

        combinedData.forEach(point => {
            if (surveyPointsMap.has(point.timestamp)) {
                point.elevation = surveyPointsMap.get(point.timestamp)!.elevation;
            }
            if (operationalActionsMap.has(point.timestamp)) {
                point.operationalAction = operationalActionsMap.get(point.timestamp)!.action;
            }
        });


        setAssetData(prev => ({ ...prev, [assetId]: { 
            data: combinedData, 
            weatherSummary: primaryDeploymentData?.processedData.weatherSummary || null, 
            overallAnalysis: primaryDeploymentData?.overallAnalysis || null,
            surveyPoints: combinedSurveyPoints,
            operationalActions: combinedOperationalActions,
            diagnostics: primaryDeploymentData?.diagnostics || null,
            loading: false 
        } }));

    } catch (error) {
        console.error(`Failed to fetch data for asset ${assetId}:`, error);
        setAssetData(prev => ({ ...prev, [assetId]: { ...initialData, loading: false } }));
    }
  }, [deployments]);


  useEffect(() => {
    async function loadInitialData() {
        setLoading(true);
        try {
            const [initialAssets, initialDeployments] = await Promise.all([
                readJsonFile<Asset[]>('data/assets.json'),
                readJsonFile<Deployment[]>('data/deployments.json')
            ]);
            
            setAssets(initialAssets);
            setDeployments(initialDeployments);
            fetchStagedFiles();
            
            if (initialAssets.length > 0) {
              const storedAssetId = localStorage.getItem('selectedAssetId');
              const assetExists = initialAssets.some(a => a.id === storedAssetId);
              const targetAssetId = storedAssetId && assetExists ? storedAssetId : initialAssets[0].id;
              setSelectedAssetId(targetAssetId);
            }
        } catch (error) {
            console.error("Failed to load initial data:", error);
            // Set to empty arrays to prevent crashes
            setAssets([]);
            setDeployments([]);
        } finally {
            setLoading(false);
        }
    }
    loadInitialData();
  }, [fetchStagedFiles]);

  // When deployments change (e.g. after create), re-fetch data for the current asset.
  useEffect(() => {
    if (selectedAssetId && deployments.length > 0) {
        fetchAssetData(selectedAssetId);
    }
  }, [deployments, selectedAssetId, fetchAssetData]);


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

  const assignDatafile = useCallback(async (formData: FormData) => {
    try {
      const result = await assignDatafileAction(formData);
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
        incrementDataVersion();
      }
      return result;
    } catch (error) {
      const message = await getErrorMessage(error);
      return { message: `Error: ${message}` };
    }
  }, [incrementDataVersion]);

  const getOverallAnalysis = useCallback(async (deploymentId: string) => {
      try {
          return await getOverallAnalysisAction(deploymentId);
      } catch (error) {
          console.error(error);
          return null;
      }
  }, []);

  const getRawOverallAnalysisJson = useCallback(async (deploymentId: string) => {
    try {
      return await getRawOverallAnalysisJsonAction(deploymentId);
    } catch (error) {
        console.error(error);
        return '{"error": "Failed to fetch raw analysis JSON."}';
    }
  }, []);
  
  const saveOverallAnalysis = useCallback(async (payload: any) => {
    try {
      const result = await saveOverallAnalysisAction(payload);
      if (result && !result.errors && result.savedData) {
        const deployment = deployments.find(d => d.id === payload.deploymentId);
        if (deployment) {
            setAssets(prev => prev.map(a => a.id === deployment.assetId ? { ...a, status: result.savedData.status } : a));
        }
        incrementDataVersion();
      }
      return result;
    } catch (error) {
       const message = await getErrorMessage(error);
       return { message: `Error: ${message}` };
    }
  }, [deployments, incrementDataVersion]);

  const checkFileExists = useCallback(async (filePath: string) => {
    try {
      return await checkFileExistsAction(filePath);
    } catch (error) {
      console.error(`Error checking file existence for ${filePath}:`, error);
      return false;
    }
  }, []);

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

  const addSurveyPoint = useCallback(async (data: any) => {
    try {
      const result = await addSurveyPointAction(data);
      if (result && !result.errors) {
        incrementDataVersion();
      }
      return result;
    } catch(error) {
        const message = await getErrorMessage(error);
        return { message: `Error: ${message}` };
    }
  }, [incrementDataVersion]);

  const deleteSurveyPoint = useCallback(async (deploymentId: string, pointId: string) => {
     try {
      const result = await deleteSurveyPointAction(deploymentId, pointId);
      if (result && !result.message.startsWith('Error:')) {
        incrementDataVersion();
      }
      return result;
    } catch(error) {
        const message = await getErrorMessage(error);
        return { message: `Error: ${message}` };
    }
  }, [incrementDataVersion]);

  const getSurveyPoints = useCallback(async (deploymentId: string) => {
    return await getSurveyPointsAction(deploymentId);
  }, []);
  
  const addOperationalAction = useCallback(async (data: any) => {
    try {
      const result = await addOperationalActionAction(data);
      if (result && !result.errors) {
        incrementDataVersion();
      }
      return result;
    } catch(error) {
        const message = await getErrorMessage(error);
        return { message: `Error: ${message}` };
    }
  }, [incrementDataVersion]);

  const deleteOperationalAction = useCallback(async (deploymentId: string, actionId: string) => {
     try {
      const result = await deleteOperationalActionAction(deploymentId, actionId);
      if (result && !result.message.startsWith('Error:')) {
        incrementDataVersion();
      }
      return result;
    } catch(error) {
        const message = await getErrorMessage(error);
        return { message: `Error: ${message}` };
    }
  }, [incrementDataVersion]);

  const getOperationalActions = useCallback(async (deploymentId: string) => {
    return await getOperationalActionsAction(deploymentId);
  }, []);

  const useAssetForm = (defaultValues?: Partial<AssetFormValues>) => {
    return useForm<AssetFormValues>({
      resolver: zodResolver(assetFormSchema),
      defaultValues,
    });
  }


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
    assignDatafile,
    reassignDatafile,
    unassignDatafile,
    deleteDatafile,
    saveAnalysis,
    getOverallAnalysis,
    getRawOverallAnalysisJson,
    saveOverallAnalysis,
    checkFileExists,
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
    useAssetForm,
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
