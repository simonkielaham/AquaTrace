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
  assets,
  deployments,
  analysisResults,
  performanceData,
  type Asset,
} from "@/lib/placeholder-data";

export default function DashboardLayout() {
  const [selectedAssetId, setSelectedAssetId] = React.useState(assets[0].id);

  const selectedAsset = assets.find((a) => a.id === selectedAssetId) as Asset;
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
            onSelectAsset={setSelectedAssetId}
          />
        </Sidebar>
        <div className="flex flex-1 flex-col">
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