
"use client";

import type { Deployment, DataFile } from "@/lib/placeholder-data";
import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, PlusCircle } from "lucide-react";
import { Button } from "../ui/button";
import { useToast } from "@/hooks/use-toast";

type DeploymentListProps = {
  deployments: Deployment[];
};

type FormattedFile = Omit<DataFile, 'startDate' | 'endDate'> & {
  startDate: string;
  endDate: string;
};

type FormattedDeployment = Omit<Deployment, 'files'> & {
  files: FormattedFile[];
};

export default function DeploymentList({ deployments }: DeploymentListProps) {
  const { toast } = useToast();
  const [formattedDeployments, setFormattedDeployments] = React.useState<FormattedDeployment[]>([]);

  React.useEffect(() => {
    setFormattedDeployments(
      deployments.map(d => ({
        ...d,
        files: d.files.map(f => ({
          ...f,
          startDate: new Date(f.startDate).toLocaleDateString(),
          endDate: f.endDate ? new Date(f.endDate).toLocaleDateString() : "Present",
        }))
      }))
    );
  }, [deployments]);

  const handleNotImplemented = () => {
    toast({
      title: "Feature not implemented",
      description: "This functionality is not yet available.",
    });
  };

  return (
    <Card className="col-span-1 lg:col-span-2 shadow-sm flex flex-col">
      <CardHeader>
        <div className="flex justify-between items-start">
            <div className="grid gap-2">
            <CardTitle className="font-headline">Deployments</CardTitle>
            <CardDescription>
                Sensor deployments and associated datafiles for this asset.
            </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleNotImplemented}>
                <PlusCircle className="mr-2 h-4 w-4" />
                New Deployment
            </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <ScrollArea className="h-[240px]">
          {formattedDeployments.map((deployment) => (
            <div key={deployment.id} className="mb-6">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold">Sensor ID: <span className="font-mono text-primary">{deployment.sensorId}</span></h3>
                    <Button variant="ghost" size="sm" onClick={handleNotImplemented}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Datafile
                    </Button>
                </div>
                 <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead>Datafile</TableHead>
                        <TableHead>Period</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {deployment.files.map((file) => (
                        <TableRow key={file.id}>
                            <TableCell className="flex items-center gap-2 text-muted-foreground">
                                <FileText className="h-4 w-4" />
                                <span className="font-mono text-xs">{file.fileName}</span>
                            </TableCell>
                            <TableCell>
                            {file.startDate} - {file.endDate}
                            </TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
          ))}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
