
"use client";

import type { Asset } from "@/lib/placeholder-data";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Info } from "lucide-react";


type PerformanceChartProps = {
  asset: Asset;
};


export default function PerformanceChart({
  asset,
}: PerformanceChartProps) {
  
  return (
    <Card className="col-span-1 lg:col-span-4 shadow-sm">
      <CardHeader>
        <CardTitle className="font-headline">Performance Overview</CardTitle>
        <CardDescription>
          Water elevation and precipitation over time against design elevations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] flex items-center justify-center text-muted-foreground bg-muted/30 rounded-lg">
            <div className="text-center">
                <Info className="mx-auto h-8 w-8 mb-2" />
                <p>Performance data is not available.</p>
                <p className="text-xs">Datafile processing has been removed.</p>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
