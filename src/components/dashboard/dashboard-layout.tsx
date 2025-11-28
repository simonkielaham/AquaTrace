"use client";

import * as React from "react";
import { SidebarProvider, Sidebar } from "@/components/ui/sidebar";
import SidebarNav from "@/components/dashboard/sidebar-nav";
import PageHeader from "@/components/dashboard/page-header";
import AssetOverview from "@/components/dashboard/asset-overview";
import DeploymentList from "@/components/dashboard/deployment-list";
import AnalysisResults from "@/components/dashboard/analysis-results";
import SurveyPointManager from "@/components/dashboard/survey-point-manager";
import TapeDownManager from "@/components/dashboard/tape-down-manager";
import OverallAnalysis from "@/components/dashboard/overall-analysis";
import OperationalActionManager from "@/components/dashboard/operational-action-manager";
import {
  ChartablePoint,
  WeatherSummary,
} from "@/lib/placeholder-data";
import { useAssets } from "@/context/asset-context";
import PerformanceChart from "@/components/dashboard/performance-chart";
import { getProcessedData as getProcessedDataAction } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import AnalysisQaqc from "./analysis-qaqc";
import FileLocationStatus from "./file-location-status";


export default function DashboardLayout() {
  const { assets, selectedAssetId, setSelectedAssetId, deployments, loading, dataVersion, fetchAssetData, assetData } = useAssets();
  const { toast } = useToast();
  
  const [chartBrushRange, setChartBrushRange] = React.useState<{startIndex?: number, endIndex?: number}>({});
  const [visibleElevations, setVisibleElevations] = React.useState<Record<string, boolean>>({});
  const [visibleSensorData, setVisibleSensorData] = React.useState<Record<string, boolean>>({});
  const [isOverallAnalysisEditing, setIsOverallAnalysisEditing] = React.useState(false);


  const selectedAsset = assets.find((a) => a.id === selectedAssetId);
  const currentAssetData = selectedAssetId ? assetData[selectedAssetId] : null;
  const isChartLoading = !currentAssetData || (currentAssetData as any).loading;
  const chartData = currentAssetData?.data || [];
  const weatherSummary = currentAssetData?.weatherSummary || null;
  const overallAnalysis = currentAssetData?.overallAnalysis || null;
  const surveyPoints = currentAssetData?.surveyPoints || [];
  const operationalActions = currentAssetData?.operationalActions || [];
  const diagnostics = currentAssetData?.diagnostics || null;

  
  // Handle case where selected asset is not found or none is selected
  React.useEffect(() => {
    if (!loading && assets.length > 0 && !assets.find(a => a.id === selectedAssetId)) {
      setSelectedAssetId(assets[0].id);
    }
  }, [selectedAssetId, assets, setSelectedAssetId, loading]);

  // This effect will re-fetch data for the current asset when dataVersion or selectedAssetId changes
  React.useEffect(() => {
    if (selectedAssetId) {
      const { id: toastId } = toast({
        title: "Fetching Data...",
        description: `Querying sensor and weather data for ${selectedAsset?.name}.`,
      });
      fetchAssetData(selectedAssetId).then(() => {
          toast({
            id: toastId,
            title: "Data Loaded Successfully",
            description: `Sensor data processed for ${selectedAsset?.name}.`,
        });
      });
    }
  }, [dataVersion, selectedAssetId, fetchAssetData, toast, selectedAsset?.name]);

  React.useEffect(() => {
    if (selectedAsset) {
      const initialVisibility = selectedAsset.designElevations.reduce((acc, de) => {
        acc[de.name] = false;
        return acc;
      }, {} as Record<string, boolean>);
      setVisibleElevations(initialVisibility);

      setVisibleSensorData({
        temperature: false,
        sensorPressure: false,
        barometer: false,
      });

      // Reset chart brush range and analysis editing state when asset changes
      setChartBrushRange({});
      setIsOverallAnalysisEditing(false);
    }
  }, [selectedAssetId, selectedAsset]);
  
  const handleSelectEventTimeRange = React.useCallback((eventStartDate: number, eventEndDate: number) => {
    if (!chartData || chartData.length === 0) return;

    const postEventEndDate = eventEndDate + 48 * 60 * 60 * 1000; // 48 hours in milliseconds

    const startIndex = chartData.findIndex(d => d.timestamp >= eventStartDate);
    let endIndex = chartData.findIndex(d => d.timestamp >= postEventEndDate);

    // If endIndex is not found (meaning the range extends beyond the data), use the last point.
    if (endIndex === -1) {
        endIndex = chartData.length - 1;
    }
    
    // Ensure startIndex is valid
    if (startIndex !== -1) {
       setChartBrushRange({ startIndex, endIndex });
    }
    
  }, [chartData]);

  const handleElevationVisibilityChange = (name: string, visible: boolean) => {
    setVisibleElevations(prev => ({ ...prev, [name]: visible }));
  };
  
  const handleSensorDataVisibilityChange = (name: string, visible: boolean) => {
    setVisibleSensorData(prev => ({ ...prev, [name]: visible }));
  }

  if (loading) {
     return (
       <div className="flex h-screen w-full items-center justify-center">
         <p>Loading data...</p>
       </div>
    )
  }

  if (assets.length === 0) {
    return (
       <div className="flex h-screen w-full items-center justify-center">
         <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">No Assets Found</h2>
          <p className="text-muted-foreground">
            Get started by creating a new asset in the Asset Management section.
            </p>
         </div>
       </div>
    )
  }

  if (!selectedAsset) {
    return (
       <div className="flex h-screen w-full items-center justify-center">
         <p>Loading asset data...</p>
       </div>
    )
  }

  const assetDeployments = deployments.filter(
    (d) => d.assetId === selectedAssetId
  );

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar>
          <SidebarNav
            assets={assets}
            selectedAssetId={selectedAssetId}
            onSelectAsset={(id) => {
              setSelectedAssetId(id);
              // No need to push router, selection change is enough
            }}
          />
        </Sidebar>
        <div className="flex-1 flex flex-col">
          <PageHeader />
          <main className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex flex-col gap-6">
              <AssetOverview 
                asset={selectedAsset} 
                visibleElevations={visibleElevations}
                onElevationVisibilityChange={handleElevationVisibilityChange}
                visibleSensorData={visibleSensorData}
                onSensorDataVisibilityChange={handleSensorDataVisibilityChange}
              />
              <FileLocationStatus asset={selectedAsset} deployments={assetDeployments} />
              <PerformanceChart 
                asset={selectedAsset} 
                chartData={chartData}
                loading={isChartLoading}
                brushRange={chartBrushRange}
                onBrushChange={setChartBrushRange}
                visibleElevations={visibleElevations}
                visibleSensorData={visibleSensorData}
              />
              <AnalysisResults 
                weatherSummary={weatherSummary} 
                diagnostics={diagnostics}
                onSelectEvent={handleSelectEventTimeRange}
              />
               <OverallAnalysis 
                  asset={selectedAsset} 
                  analysisData={overallAnalysis} 
                  loading={isChartLoading}
                  isEditing={isOverallAnalysisEditing}
                  onEditChange={setIsOverallAnalysisEditing}
                />
              <AnalysisQaqc asset={selectedAsset} />
              <DeploymentList deployments={assetDeployments} asset={selectedAsset} />
              <SurveyPointManager 
                asset={selectedAsset} 
                deployments={assetDeployments} 
                data={chartData} 
                surveyPoints={surveyPoints} 
                loading={isChartLoading}
              />
              <TapeDownManager 
                asset={selectedAsset} 
                deployments={assetDeployments} 
                data={chartData} 
                surveyPoints={surveyPoints} 
                loading={isChartLoading} 
              />
              <OperationalActionManager 
                asset={selectedAsset} 
                deployments={assetDeployments} 
                operationalActions={operationalActions} 
                loading={isChartLoading} 
              />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
