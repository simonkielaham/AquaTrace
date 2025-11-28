"use client";

import { Download, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAssets } from "@/context/asset-context";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { generateReport } from "@/lib/report-generator";
import * as React from "react";


export default function PageHeader() {
  const { toast } = useToast();
  const { selectedAssetId, assets, deployments, getOverallAnalysis, assetData } = useAssets();
  const { logout } = useAuth();
  const currentAssetData = selectedAssetId ? assetData[selectedAssetId] : null;
  const [isGenerating, setIsGenerating] = React.useState(false);

  const handleGenerateReport = async () => {
    if (!selectedAssetId || !currentAssetData) {
      toast({
        variant: "destructive",
        title: "No Asset Selected",
        description: "Please select an asset before generating a report.",
      });
      return;
    }
    
    toast({
        id: "report-status",
        title: "Verifying Report Data...",
        description: "Please wait while we check your analysis.",
    });

    setIsGenerating(true);

    // This needs to fetch the analysis for the *first* deployment of the asset.
    const asset = assets.find(a => a.id === selectedAssetId);
    if (!asset) {
        toast({ variant: "destructive", title: "Error", description: "Selected asset not found." });
        setIsGenerating(false);
        return;
    }
    const firstDeployment = deployments.find(d => d.assetId === asset.id);
    if (!firstDeployment) {
        toast({ variant: "destructive", title: "Error", description: "No deployments found for this asset to source analysis from." });
        setIsGenerating(false);
        return;
    }
    const overallAnalysis = await getOverallAnalysis(firstDeployment.id);
    
    const events = currentAssetData.weatherSummary?.events || [];
    const assetDeployments = deployments.filter(d => d.assetId === selectedAssetId);
    const diagnostics = currentAssetData.diagnostics;


    if (!asset) {
         toast({
            variant: "destructive",
            title: "Asset Not Found",
            description: "Could not find the selected asset details.",
        });
        setIsGenerating(false);
        return;
    }

    const missingOverallFields: string[] = [];
    if (!overallAnalysis) {
        missingOverallFields.push("Complete the 'Overall Asset Analysis' section.");
    } else {
        if (!overallAnalysis.permanentPoolPerformance) missingOverallFields.push("Permanent Pool Performance");
        if (overallAnalysis.estimatedControlElevation === undefined || overallAnalysis.estimatedControlElevation === null) missingOverallFields.push("Estimated Control Elevation");
        if (!overallAnalysis.rainResponse) missingOverallFields.push("Response to Rain Events");
        if (!overallAnalysis.furtherInvestigation) missingOverallFields.push("Further Investigation");
        if (!overallAnalysis.summary) missingOverallFields.push("Analysis Summary");
        if (!overallAnalysis.analystInitials) missingOverallFields.push("Overall Analysis Sign-off");
    }

    const unreviewedEvents = events.filter(
        (event) => !event.analysis?.disregarded && !event.analysis?.analystInitials
    );
    
    if (missingOverallFields.length > 0 || unreviewedEvents.length > 0) {
      let description = "Please complete the following items:\n";
      if (missingOverallFields.length > 0) {
        description += `\nOverall Analysis:\n- ${missingOverallFields.join('\n- ')}\n`;
      }
      if (unreviewedEvents.length > 0) {
        description += `\nUnreviewed Events:\n- ${unreviewedEvents.length} precipitation event(s) need to be signed off on or disregarded.`;
      }

      toast({
        variant: "destructive",
        title: "Incomplete Analysis",
        description: (
          <pre className="mt-2 w-full whitespace-pre-wrap break-all rounded-md bg-slate-950 p-4">
            <code className="text-white">{description}</code>
          </pre>
        ),
      });
      setIsGenerating(false);
    } else {
      // All checks passed, proceed with report generation
      toast({
        id: "report-status",
        title: "Generating Report...",
        description: "This may take a moment. Please wait.",
      });

      try {
        await generateReport({
            asset: asset,
            deployments: assetDeployments,
            chartData: currentAssetData.data,
            weatherSummary: currentAssetData.weatherSummary,
            overallAnalysis: overallAnalysis!,
            diagnostics: diagnostics,
        }, (progress) => {
             toast({
                id: "report-status",
                title: "Generating Report...",
                description: progress,
            });
        });

         toast({
            id: "report-status",
            title: "Report Generated!",
            description: "Your PDF download will begin shortly.",
        });

      } catch (error) {
         toast({
            id: "report-status",
            variant: "destructive",
            title: "Error Generating Report",
            description: error instanceof Error ? error.message : "An unknown error occurred.",
        });
      } finally {
        setIsGenerating(false);
      }
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      <div className="flex items-center gap-2">
        <h1 className="font-headline text-xl font-semibold md:text-2xl">
          Dashboard
        </h1>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          onClick={handleGenerateReport}
          disabled={isGenerating}
        >
          {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
            {isGenerating ? "Generating..." : "Generate Report"}
          </span>
        </Button>
        <Button
            size="sm"
            variant="ghost"
            onClick={() => logout()}
            title="Log Out"
        >
            <LogOut className="h-4 w-4" />
            <span className="sr-only">Log Out</span>
        </Button>
      </div>
    </header>
  );
}
