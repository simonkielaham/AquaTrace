import type { Deployment } from "@/lib/placeholder-data";
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

type DeploymentListProps = {
  deployments: Deployment[];
};

export default function DeploymentList({ deployments }: DeploymentListProps) {
  return (
    <Card className="col-span-1 lg:col-span-2 shadow-sm">
      <CardHeader className="flex flex-row items-center">
        <div className="grid gap-2">
          <CardTitle className="font-headline">Deployments</CardTitle>
          <CardDescription>
            Manage sensor deployments and datafiles for this asset.
          </CardDescription>
        </div>
        <Button size="sm" className="ml-auto gap-1">
          <Upload className="h-3.5 w-3.5" />
          <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
            Upload CSV
          </span>
        </Button>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[280px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sensor ID</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Files</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deployments.map((deployment) => (
                <TableRow key={deployment.id}>
                  <TableCell className="font-medium">
                    {deployment.sensorId}
                  </TableCell>
                  <TableCell>
                    {new Date(deployment.startDate).toLocaleDateString()} -{" "}
                    {deployment.endDate
                      ? new Date(deployment.endDate).toLocaleDateString()
                      : "Present"}
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
      </CardContent>
    </Card>
  );
}
