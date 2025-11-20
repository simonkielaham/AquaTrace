
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
import { Droplets } from "lucide-react";
import { format, formatDistance } from "date-fns";

type AnalysisResultsProps = {
  weatherSummary: WeatherSummary | null;
  onSelectEvent: (startDate: number, endDate: number) => void;
};

const formatDuration = (start: number, end: number) => {
  return formatDistance(new Date(start), new Date(end), { includeSeconds: true });
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
                <TableHead>End Time</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="text-right">Total Precipitation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {weatherSummary.events.map((event) => (
                <TableRow 
                  key={event.id}
                  className="cursor-pointer"
                  onClick={() => onSelectEvent(event.startDate, event.endDate)}
                >
                  <TableCell>{format(new Date(event.startDate), 'Pp')}</TableCell>
                  <TableCell>{format(new Date(event.endDate), 'Pp')}</TableCell>
                  <TableCell>{formatDuration(event.startDate, event.endDate)}</TableCell>
                  <TableCell className="text-right font-medium">
                     <div className="flex items-center justify-end gap-2">
                        <Droplets className="h-4 w-4 text-blue-400" />
                        <span>{event.totalPrecipitation.toFixed(2)} mm</span>
                     </div>
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
