
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
import {
  ChartablePoint,
  WeatherSummary,
} from "@/lib/placeholder-data";
import { useAssets } from "@/context/asset-context";
import PerformanceChart from "@/components/dashboard/performance-chart";
import { getProcessedData as getProcessedDataAction } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";


export default function DashboardLayout() {
  const { assets, selectedAssetId, setSelectedAssetId, deployments, loading, dataVersion } = useAssets();
  const { toast } = useToast();
  const [chartData, setChartData] = React.useState<ChartablePoint[]>([]);
  const [weatherSummary, setWeatherSummary] = React.useState<WeatherSummary | null>(null);
  const [isChartLoading, setIsChartLoading] = React.useState(true);
  const [chartBrushRange, setChartBrushRange] = React.useState<{startIndex?: number, endIndex?: number}>({});

  const selectedAsset = assets.find((a) => a.id === selectedAssetId);
  
  // Handle case where selected asset is not found or none is selected
  React.useEffect(() => {
    if (!loading && assets.length > 0 && !assets.find(a => a.id === selectedAssetId)) {
      setSelectedAssetId(assets[0].id);
    }
  }, [selectedAssetId, assets, setSelectedAssetId, loading]);

  React.useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      if (!selectedAsset) return;
      setIsChartLoading(true);

      const { id: toastId } = toast({
        title: "Fetching Data...",
        description: `Querying sensor and weather data for ${selectedAsset.name}.`,
      });
      
      const processedDataResult = await getProcessedDataAction(selectedAsset.id);
      
      if (isMounted) {
        const { data: combinedData, weatherSummary } = processedDataResult;

        setChartData(combinedData);
        setWeatherSummary(weatherSummary);
        setChartBrushRange({}); // Reset brush on new data
        setIsChartLoading(false);
        
        toast({
            id: toastId,
            title: "Data Loaded Successfully",
            description: (
              <div>
                <p>Sensor data processed for {selectedAsset.name}.</p>
                {weatherSummary && (
                  <p>
                    Found{" "}
                    <span className="font-bold">
                      {weatherSummary.events.length}
                    </span>{" "}
                    precipitation events totaling{" "}
                    <span className="font-bold">
                        {weatherSummary.totalPrecipitation.toFixed(2)}mm
                    </span>.
                  </p>
                )}
              </div>
            ),
        });
      }
    };
    fetchData();
    return () => { isMounted = false };
  }, [selectedAsset, dataVersion, toast]);
  
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
              <AssetOverview asset={selectedAsset} />
              <PerformanceChart 
                asset={selectedAsset} 
                chartData={chartData}
                loading={isChartLoading}
                brushRange={chartBrushRange}
                onBrushChange={setChartBrushRange}
              />
              <AnalysisResults 
                weatherSummary={weatherSummary} 
                onSelectEvent={handleSelectEventTimeRange}
              />
              <DeploymentList deployments={assetDeployments} asset={selectedAsset} />
              <SurveyPointManager asset={selectedAsset} dataVersion={dataVersion} />
              <TapeDownManager asset={selectedAsset} deployments={assetDeployments} dataVersion={dataVersion} />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
