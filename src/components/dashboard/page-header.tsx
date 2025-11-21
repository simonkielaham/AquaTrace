
"use client";

import { Download, LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAssets } from "@/context/asset-context";
import { useToast } from "@/hooks/use-toast";
import { OverallAnalysisData } from "@/lib/placeholder-data";

export default function PageHeader() {
  const { toast } = useToast();
  const { selectedAssetId, assetData, getOverallAnalysis } = useAssets();
  const currentAssetData = selectedAssetId ? assetData[selectedAssetId] : null;

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
        title: "Verifying Report Data...",
        description: "Please wait while we check your analysis.",
    });

    const overallAnalysis = await getOverallAnalysis(selectedAssetId);
    const events = currentAssetData.weatherSummary?.events || [];

    const missingOverallFields: string[] = [];
    if (!overallAnalysis) {
        missingOverallFields.push("Complete the 'Overall Asset Analysis' section.");
    } else {
        if (!overallAnalysis.permanentPoolPerformance) missingOverallFields.push("Permanent Pool Performance");
        if (!overallAnalysis.estimatedControlElevation) missingOverallFields.push("Estimated Control Elevation");
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
    } else {
      // All checks passed, proceed with report generation
      toast({
        title: "Generating Report...",
        description: "Your report will be downloaded shortly.",
      });
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
        >
          <Download className="h-3.5 w-3.5" />
          <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
            Generate Report
          </span>
        </Button>
      </div>
    </header>
  );
}
