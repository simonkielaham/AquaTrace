
"use client";

import type { Asset, Deployment } from "@/lib/placeholder-data";
import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAssets } from "@/context/asset-context";
import { ChevronDown, FileJson, Loader2 } from "lucide-react";

interface AnalysisQaqcProps {
  asset: Asset;
  deployments: Deployment[];
}

export default function AnalysisQaqc({ asset, deployments }: AnalysisQaqcProps) {
  const { getRawOverallAnalysisJson } = useAssets();
  const [jsonContent, setJsonContent] = React.useState<string>("");
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const firstDeployment = deployments.find(d => d.assetId === asset.id);
    if (firstDeployment) {
      setIsLoading(true);
      getRawOverallAnalysisJson(firstDeployment.id)
        .then((content) => {
          setJsonContent(content);
        })
        .catch((err) => {
            console.error("Failed to fetch raw analysis JSON", err);
            setJsonContent('{\n  "error": "Failed to fetch analysis data."\n}');
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
        setJsonContent('{\n  "error": "No deployments found for this asset."\n}');
        setIsLoading(false);
    }
  }, [asset?.id, deployments, getRawOverallAnalysisJson]);

  return (
    <Card className="col-span-1 lg:col-span-4 shadow-sm">
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1" className="border-b-0">
          <AccordionTrigger className="p-6">
            <div className="flex items-start gap-4 text-left">
              <FileJson className="h-6 w-6 shrink-0 text-muted-foreground" />
              <div>
                <CardTitle className="font-headline text-2xl">
                  Analysis QA/QC
                </CardTitle>
                <CardDescription className="mt-1">
                  View the raw saved JSON output for the overall asset analysis to verify server-side persistence.
                </CardDescription>
              </div>
            </div>
            <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-200" />
          </AccordionTrigger>
          <AccordionContent>
            <CardContent>
              {isLoading ? (
                 <div className="flex items-center justify-center h-48 rounded-md bg-muted/50">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Loading Saved Data from Server...</span>
                 </div>
              ) : (
                <ScrollArea className="h-64 w-full rounded-md bg-muted/50 p-4">
                  <pre className="text-sm text-foreground font-mono">
                    <code>{jsonContent}</code>
                  </pre>
                </ScrollArea>
              )}
            </CardContent>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}
