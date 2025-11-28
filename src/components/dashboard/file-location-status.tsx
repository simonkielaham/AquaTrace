
"use client";

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
import { useAssets } from "@/context/asset-context";
import { Asset, Deployment } from "@/lib/placeholder-data";
import { CheckCircle, XCircle, Loader2, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileLocationStatusProps {
  asset: Asset;
  deployments: Deployment[];
}

interface FileStatus {
  path: string;
  exists: boolean | null; // null for unchecked, boolean for checked
  description: string;
}

const FileRow = ({ file, checkFile }: { file: FileStatus, checkFile: (path: string) => void }) => {
  React.useEffect(() => {
    if (file.exists === null) {
      checkFile(file.path);
    }
  }, [file, checkFile]);

  return (
    <div className="flex items-center justify-between text-sm py-2 px-3 rounded-md hover:bg-muted/50">
      <div className="flex flex-col">
        <span className="font-mono text-xs text-muted-foreground break-all">{file.path}</span>
        <span className="text-xs text-muted-foreground/80">{file.description}</span>
      </div>
      <div className="pl-4">
        {file.exists === null && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {file.exists === true && <CheckCircle className="h-4 w-4 text-green-500" />}
        {file.exists === false && <XCircle className="h-4 w-4 text-destructive" />}
      </div>
    </div>
  );
};


export default function FileLocationStatus({ asset, deployments }: FileLocationStatusProps) {
  const { checkFileExists } = useAssets();
  const [fileStatuses, setFileStatuses] = React.useState<Record<string, FileStatus>>({});

  const generateFilePaths = React.useCallback(() => {
    const paths: Record<string, FileStatus> = {};
    const addPath = (path: string, description: string) => {
        paths[path] = { path, exists: null, description };
    };

    // Central files
    addPath('data/assets.json', `Master asset list (contains '${asset.name}')`);
    addPath('data/deployments.json', 'Master deployment list');
    addPath('data/activity-log.json', 'Global application activity log');
    addPath('data/analysis-results.json', 'Per-event analysis notes and status');

    // Deployment-specific files
    deployments.forEach(dep => {
        const depDir = `data/processed/${dep.id}`;
        addPath(`${depDir}/data.json`, `Processed time-series data for deployment '${dep.name}'`);
        addPath(`${depDir}/events.json`, `Precipitation event summaries for '${dep.name}'`);
        addPath(`${depDir}/deployment-analysis.json`, `Overall analysis for '${dep.name}'`);
        addPath(`${depDir}/survey-points.json`, `Survey points for '${dep.name}'`);
        addPath(`${depDir}/operational-actions.json`, `Operational logs for '${dep.name}'`);
    });
    
    return paths;

  }, [asset, deployments]);

  React.useEffect(() => {
    setFileStatuses(generateFilePaths());
  }, [asset, deployments, generateFilePaths]);

  const handleCheckFile = React.useCallback(async (path: string) => {
    const exists = await checkFileExists(path);
    setFileStatuses(prev => ({
      ...prev,
      [path]: { ...prev[path], exists }
    }));
  }, [checkFileExists]);
  
  const sortedFilePaths = Object.keys(fileStatuses).sort();

  return (
    <Card className="col-span-1 lg:col-span-4 shadow-sm">
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1" className="border-b-0">
          <AccordionTrigger className="p-6">
            <div className="flex items-start gap-4 text-left">
              <FolderOpen className="h-6 w-6 shrink-0 text-muted-foreground" />
              <div>
                <CardTitle className="font-headline text-lg">
                  Data File Locations
                </CardTitle>
                <CardDescription className="mt-1">
                  Expected locations of saved JSON data for this asset and its deployments.
                </CardDescription>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <CardContent>
                <div className="space-y-1 rounded-md border p-2 max-h-[300px] overflow-y-auto">
                    {sortedFilePaths.length > 0 ? sortedFilePaths.map(path => (
                        <FileRow key={path} file={fileStatuses[path]} checkFile={handleCheckFile} />
                    )) : (
                        <p className="text-sm text-center text-muted-foreground p-4">No deployments found for this asset.</p>
                    )}
                </div>
            </CardContent>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}
