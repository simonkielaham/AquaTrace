"use client";

import type { Deployment } from "@/lib/placeholder-data";
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
import { Button } from "@/components/ui/button";
import { Upload, File } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

type DeploymentListProps = {
  deployments: Deployment[];
};

type FormattedDeployment = Omit<Deployment, 'startDate' | 'endDate'> & {
  startDate: string;
  endDate: string;
};

export default function DeploymentList({ deployments }: DeploymentListProps) {
  const { toast } = useToast();
  const [formattedDeployments, setFormattedDeployments] = React.useState<FormattedDeployment[]>([]);

  React.useEffect(() => {
    setFormattedDeployments(
      deployments.map(d => ({
        ...d,
        startDate: new Date(d.startDate).toLocaleDateString(),
        endDate: d.endDate ? new Date(d.endDate).toLocaleDateString() : "Present",
      }))
    )
  }, [deployments]);

  return (
    <Card className="col-span-1 lg:col-span-2 shadow-sm flex flex-col">
      <CardHeader className="flex flex-row items-center">
        <div className="grid gap-2">
          <CardTitle className="font-headline">Deployments</CardTitle>
          <CardDescription>
            Manage sensor deployments and datafiles for this asset.
          </CardDescription>
        </div>
        <Button
          size="sm"
          className="ml-auto gap-1"
          onClick={() => {
            toast({
              title: "File Upload",
              description: "Please select a CSV file to upload.",
            });
          }}
        >
          <Upload className="h-3.5 w-3.5" />
          <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
            Upload CSV
          </span>
        </Button>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="h-full">
          <ScrollArea className="h-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sensor ID</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Files</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {formattedDeployments.map((deployment) => (
                  <TableRow key={deployment.id}>
                    <TableCell className="font-medium">
                      {deployment.sensorId}
                    </TableCell>
                    <TableCell>
                      {deployment.startDate} - {deployment.endDate}
                    </TableCell>
                    <TableCell className="text-right flex items-center justify-end gap-1 text-muted-foreground">
                      <File className="h-3 w-3" />
                      {deployment.fileCount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
