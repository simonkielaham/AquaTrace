
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
  analysisResults,
} from "@/lib/placeholder-data";
import { useAssets } from "@/context/asset-context";
import PerformanceChart from "@/components/dashboard/performance-chart";


export default function DashboardLayout() {
  const { assets, selectedAssetId, setSelectedAssetId, deployments, loading, dataVersion } = useAssets();

  const selectedAsset = assets.find((a) => a.id === selectedAssetId);
  
  // Handle case where selected asset is not found or none is selected
  React.useEffect(() => {
    if (!loading && assets.length > 0 && !assets.find(a => a.id === selectedAssetId)) {
      setSelectedAssetId(assets[0].id);
    }
  }, [selectedAssetId, assets, setSelectedAssetId, loading]);

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
  const assetAnalysisResults = analysisResults.filter(
    (r) => r.assetId === selectedAssetId
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
              <PerformanceChart asset={selectedAsset} dataVersion={dataVersion}/>
              <DeploymentList deployments={assetDeployments} asset={selectedAsset} />
              <SurveyPointManager asset={selectedAsset} dataVersion={dataVersion} />
              <TapeDownManager asset={selectedAsset} deployments={assetDeployments} />
              <AnalysisResults results={assetAnalysisResults} />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

    
