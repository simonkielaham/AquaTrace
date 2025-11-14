
"use client";

import * as React from "react";
import { SidebarProvider, Sidebar } from "@/components/ui/sidebar";
import SidebarNav from "@/components/dashboard/sidebar-nav";
import PageHeader from "@/components/dashboard/page-header";
import AssetOverview from "@/components/dashboard/asset-overview";
import PerformanceChart from "@/components/dashboard/performance-chart";
import DeploymentList from "@/components/dashboard/deployment-list";
import AnalysisResults from "@/components/dashboard/analysis-results";
import {
  deployments,
  analysisResults,
  performanceData,
  type Asset,
} from "@/lib/placeholder-data";
import { useAssets } from "@/context/asset-context";
import { useRouter } from "next/navigation";


export default function DashboardLayout() {
  const router = useRouter();
  const { assets, selectedAssetId, setSelectedAssetId } = useAssets();

  const selectedAsset = assets.find((a) => a.id === selectedAssetId) as Asset;
  
  // Handle case where selected asset is not found (e.g. after a refresh)
  React.useEffect(() => {
    if (!selectedAsset && assets.length > 0) {
      setSelectedAssetId(assets[0].id);
    }
  }, [selectedAsset, assets, setSelectedAssetId]);

  if (!selectedAsset) {
    return (
       <div className="flex h-screen w-full items-center justify-center">
         <p>Loading assets...</p>
       </div>
    )
  }

  const assetDeployments = deployments.filter(
    (d) => d.assetId === selectedAssetId
  );
  const assetAnalysisResults = analysisResults.filter(
    (r) => r.assetId === selectedAssetId
  );
  const assetPerformanceData = performanceData[selectedAssetId] || [];

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar>
          <SidebarNav
            assets={assets}
            selectedAssetId={selectedAssetId}
            onSelectAsset={(id) => {
              setSelectedAssetId(id);
              router.push('/');
            }}
          />
        </Sidebar>
        <div className="flex-1 flex flex-col">
          <PageHeader />
          <main className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <AssetOverview asset={selectedAsset} />
              <PerformanceChart
                data={assetPerformanceData}
                poolElevation={selectedAsset.permanentPoolElevation}
              />
              <DeploymentList deployments={assetDeployments} />
              <AnalysisResults results={assetAnalysisResults} />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
