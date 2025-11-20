
"use client";

import type { WeatherSummary, AnalysisPeriod } from "@/lib/placeholder-data";
import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
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
import { Droplets, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { format, formatDistance } from "date-fns";

type AnalysisResultsProps = {
  weatherSummary: WeatherSummary | null;
  onSelectEvent: (startDate: number, endDate: number) => void;
};

const formatDuration = (start: number, end: number) => {
  return formatDistance(new Date(start), new Date(end), { includeSeconds: true });
};

const MetricCell = ({ value, unit, icon: Icon, iconColor }: { value?: number, unit: string, icon: React.ElementType, iconColor?: string }) => {
  if (value === undefined || value === null) {
    return <TableCell className="text-center">-</TableCell>;
  }
  return (
     <TableCell>
        <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${iconColor || 'text-muted-foreground'}`} />
            <span>{value.toFixed(2)}{unit}</span>
        </div>
    </TableCell>
  )
};

export default function AnalysisResults({ weatherSummary, onSelectEvent }: AnalysisResultsProps) {
  if (!weatherSummary || weatherSummary.events.length === 0) {
    return (
      <Card className="col-span-1 lg:col-span-4 shadow-sm">
        <CardHeader>
          <CardTitle className="font-headline">Precipitation Event Analysis</CardTitle>
          <CardDescription>
            A summary of identified rain events based on your criteria.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <p>No precipitation events found in the selected date range.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-1 lg:col-span-4 shadow-sm">
      <CardHeader>
        <CardTitle className="font-headline">Precipitation Event Analysis</CardTitle>
        <CardDescription>
          A summary of identified rain events. Total precipitation for period: <span className="font-bold">{weatherSummary.totalPrecipitation.toFixed(2)}mm</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Start Time</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Precipitation</TableHead>
                <TableHead>Baseline Elev.</TableHead>
                <TableHead>Peak Elev.</TableHead>
                <TableHead>Post-Event Elev.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {weatherSummary.events.map((event) => (
                <TableRow 
                  key={event.id}
                  className="cursor-pointer"
                  onClick={() => onSelectEvent(event.startDate, event.endDate)}
                >
                  <TableCell className="font-medium">{format(new Date(event.startDate), 'Pp')}</TableCell>
                  <TableCell>{formatDuration(event.startDate, event.endDate)}</TableCell>
                  <MetricCell value={event.totalPrecipitation} unit=" mm" icon={Droplets} iconColor="text-blue-400" />
                  <MetricCell value={event.analysis?.baselineElevation} unit="m" icon={ArrowRight} />
                  <MetricCell value={event.analysis?.peakElevation} unit="m" icon={TrendingUp} iconColor="text-destructive" />
                  <MetricCell value={event.analysis?.postEventElevation} unit="m" icon={TrendingDown} iconColor="text-green-500" />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
