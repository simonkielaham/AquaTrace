
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Droplets, TrendingUp, TrendingDown, ArrowRight, ChevronDown, CheckCircle, XCircle, AlertCircle, Save } from "lucide-react";
import { format, formatDistance } from "date-fns";
import { cn } from "@/lib/utils";

type AnalysisResultsProps = {
  weatherSummary: WeatherSummary | null;
  onSelectEvent: (startDate: number, endDate: number) => void;
};

const formatDuration = (start: number, end: number) => {
  return formatDistance(new Date(start), new Date(end), { includeSeconds: true });
};

const MetricCard = ({ title, value, unit, icon: Icon, iconColor, subValue }: { title: string, value?: number, unit: string, icon: React.ElementType, iconColor?: string, subValue?: string }) => {
    return (
        <div className="flex items-start gap-3 rounded-lg border p-3">
            <Icon className={`h-5 w-5 mt-1 shrink-0 ${iconColor || 'text-muted-foreground'}`} />
            <div>
                <p className="text-sm text-muted-foreground">{title}</p>
                {value !== undefined && value !== null ? (
                    <p className="text-xl font-bold font-headline">{value.toFixed(3)}<span className="text-sm font-normal font-body text-muted-foreground ml-1">{unit}</span></p>
                ) : (
                     <p className="text-sm text-muted-foreground mt-2">Not available</p>
                )}
                {subValue && <p className="text-xs text-muted-foreground">{subValue}</p>}
            </div>
        </div>
    )
}

function EventAnalysisDetails({ event }: { event: AnalysisPeriod }) {
  const [notes, setNotes] = React.useState(event.analysis?.notes || "");
  const [status, setStatus] = React.useState(event.analysis?.status || "normal");
  
  const timeToBaseline = "Not implemented";
  const drawdownAnalysis = "Not implemented";
  const estimatedBaseline = "Not implemented";

  const peakDiff = React.useMemo(() => {
    if (event.analysis?.peakElevation && event.analysis?.baselineElevation) {
      return event.analysis.peakElevation - event.analysis.baselineElevation;
    }
    return undefined;
  }, [event.analysis]);

  const postEventDiff = React.useMemo(() => {
    if (event.analysis?.postEventElevation && event.analysis?.baselineElevation) {
      return event.analysis.postEventElevation - event.analysis.baselineElevation;
    }
    return undefined;
  }, [event.analysis]);
  
  const overallAssessment = React.useMemo(() => {
    if(event.analysis?.postEventElevation && event.analysis?.baselineElevation) {
      if (event.analysis.postEventElevation > event.analysis.baselineElevation + 0.05) { // 5cm tolerance
        return { 
          text: "Asset did not return to pre-event baseline within 48 hours.",
          icon: XCircle,
          color: "text-destructive"
        };
      }
    }
    return {
      text: "Asset returned to pre-event baseline within 48 hours.",
      icon: CheckCircle,
      color: "text-green-600"
    };

  }, [event.analysis]);
  

  return (
    <div className="bg-muted/30 p-4 rounded-b-md">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                 <MetricCard 
                    title="Baseline Elevation"
                    value={event.analysis?.baselineElevation}
                    unit="m"
                    icon={ArrowRight}
                    subValue="3 hours prior to event"
                 />
                 <MetricCard 
                    title="Peak Elevation"
                    value={event.analysis?.peakElevation}
                    unit="m"
                    icon={TrendingUp}
                    iconColor="text-destructive"
                    subValue={peakDiff !== undefined ? `${peakDiff > 0 ? '+' : ''}${peakDiff.toFixed(2)}m from baseline` : "During event + 48hrs"}
                 />
                 <MetricCard 
                    title="Post-Event Elevation"
                    value={event.analysis?.postEventElevation}
                    unit="m"
                    icon={TrendingDown}
                    iconColor="text-green-500"
                    subValue={postEventDiff !== undefined ? `${postEventDiff > 0 ? '+' : ''}${postEventDiff.toFixed(2)}m from baseline` : "48 hours after event"}
                 />
                <div className="p-3 border rounded-lg col-span-full">
                    <p className="text-sm font-semibold">Detailed Analysis</p>
                    <div className="mt-2 text-sm text-muted-foreground space-y-1">
                        <p><span className="font-medium">Time to Baseline:</span> {timeToBaseline}</p>
                        <p><span className="font-medium">Drawdown Analysis:</span> {drawdownAnalysis}</p>
                        <p><span className="font-medium">Estimated True Baseline:</span> {estimatedBaseline}</p>
                    </div>
                </div>

                <div className="p-4 border bg-background rounded-lg col-span-full">
                    <p className="font-medium text-sm mb-2">Analyst Notes</p>
                    <Textarea 
                        placeholder="Add notes about this event..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="min-h-[80px]"
                    />
                </div>
            </div>

            <div className="space-y-4">
                <div className="p-4 border bg-background rounded-lg">
                    <p className="font-medium text-sm">Event ID</p>
                    <p className="text-xs text-muted-foreground font-mono mt-1 break-all">{event.id}</p>
                </div>
                <div className="p-4 border bg-background rounded-lg">
                    <p className="font-medium text-sm mb-2">Overall Assessment</p>
                     <div className={cn("flex items-center gap-2 text-sm", overallAssessment.color)}>
                        <overallAssessment.icon className="h-4 w-4 shrink-0" />
                        <p>{overallAssessment.text}</p>
                     </div>
                </div>
                 <div className="p-4 border bg-background rounded-lg">
                    <p className="font-medium text-sm mb-3">Asset Status During Event</p>
                    <RadioGroup value={status} onValueChange={(value) => setStatus(value as any)}>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="normal" id={`status-normal-${event.id}`} />
                            <Label htmlFor={`status-normal-${event.id}`}>Operating Normally</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="holding_water" id={`status-holding-${event.id}`} />
                            <Label htmlFor={`status-holding-${event.id}`}>Holding Water</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="leaking" id={`status-leaking-${event.id}`} />
                            <Label htmlFor={`status-leaking-${event.id}`}>Potential Leak</Label>
                        </div>
                    </RadioGroup>
                </div>
                <Button className="w-full">
                    <Save className="mr-2 h-4 w-4" />
                    Save Analysis
                </Button>
            </div>
        </div>
    </div>
  )
}


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
            <AlertCircle className="mx-auto h-8 w-8 mb-2" />
            <p>No significant precipitation events found in the selected date range.</p>
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
        <Accordion type="multiple" className="space-y-2">
            {weatherSummary.events.map((event) => {
                const peakDiff = event.analysis?.peakElevation && event.analysis?.baselineElevation
                    ? event.analysis.peakElevation - event.analysis.baselineElevation
                    : undefined;

                const postEventDiff = event.analysis?.postEventElevation && event.analysis?.baselineElevation
                    ? event.analysis.postEventElevation - event.analysis.baselineElevation
                    : undefined;
                    
                return (
                    <AccordionItem value={event.id} key={event.id} className="border rounded-lg bg-background">
                        <AccordionTrigger 
                            className="p-4 hover:no-underline"
                            onClick={() => onSelectEvent(event.startDate, event.endDate)}
                        >
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-left flex-1 items-center text-sm">
                                 <div className="font-medium">{format(new Date(event.startDate), 'Pp')}</div>
                                 <div>{formatDuration(event.startDate, event.endDate)}</div>
                                 <div className="flex items-center gap-2">
                                    <Droplets className="h-4 w-4 text-blue-400" />
                                    <span>{event.totalPrecipitation.toFixed(2)} mm</span>
                                 </div>
                                 <div className="hidden md:flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-destructive" />
                                    <div className="flex flex-col items-start">
                                      <span>{event.analysis?.peakElevation?.toFixed(2) ?? '-'} m</span>
                                      {peakDiff !== undefined && (
                                        <span className="text-xs text-destructive/80 font-mono">
                                            {peakDiff > 0 ? '+' : ''}{peakDiff.toFixed(2)}m
                                        </span>
                                      )}
                                    </div>
                                 </div>
                                <div className={cn(
                                    "hidden md:flex items-center gap-2",
                                    postEventDiff !== undefined && postEventDiff > 0.05 ? "text-destructive" : "text-green-600"
                                )}>
                                    <TrendingDown className="h-4 w-4" />
                                    <div className="flex flex-col items-start">
                                        <span>{event.analysis?.postEventElevation?.toFixed(2) ?? '-'} m</span>
                                        {postEventDiff !== undefined && (
                                            <span className={cn("text-xs font-mono", postEventDiff > 0.05 ? "text-destructive/80" : "text-green-600/80")}>
                                               {postEventDiff > 0 ? '+' : ''}{postEventDiff.toFixed(2)}m
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 ml-4" />
                        </AccordionTrigger>
                        <AccordionContent>
                            <EventAnalysisDetails event={event} />
                        </AccordionContent>
                    </AccordionItem>
                )
            })}
        </Accordion>
      </CardContent>
    </Card>
  );
}

    