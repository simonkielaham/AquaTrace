
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText } from "lucide-react";

type DeploymentListProps = {
  deployments: Deployment[];
};

type FormattedDeployment = Omit<Deployment, 'startDate' | 'endDate'> & {
  startDate: string;
  endDate: string;
};

export default function DeploymentList({ deployments }: DeploymentListProps) {
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
      <CardHeader>
        <div className="grid gap-2">
          <CardTitle className="font-headline">Deployments</CardTitle>
          <CardDescription>
            Sensor deployments and associated datafiles for this asset.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="h-full">
          <ScrollArea className="h-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sensor ID</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Datafile</TableHead>
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
                    <TableCell className="flex items-center gap-2 text-muted-foreground">
                       <FileText className="h-4 w-4" />
                      <span className="font-mono text-xs">{deployment.fileName}</span>
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
