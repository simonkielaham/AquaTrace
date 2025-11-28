
"use client";

import type { WeatherSummary, AnalysisPeriod } from "@/lib/placeholder-data";
import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Droplets, TrendingUp, TrendingDown, ArrowRight, ChevronDown, CheckCircle, XCircle, AlertCircle, Save, Loader2, Edit, EyeOff, Pencil, X, Clock, AreaChart } from "lucide-react";
import { format, formatDistance } from "date-fns";
import { cn } from "@/lib/utils";
import { useAssets } from "@/context/asset-context";
import { useToast } from "@/hooks/use-toast";

type AnalysisResultsProps = {
  weatherSummary: WeatherSummary | null;
  onSelectEvent: (startDate: number, endDate: number) => void;
};

const formatDuration = (start: number, end: number) => {
  return formatDistance(new Date(start), new Date(end), { includeSeconds: true });
};

const MetricCard = ({ title, value, unit, icon: Icon, iconColor, subValue }: { title: string, value?: number | string, unit?: string, icon: React.ElementType, iconColor?: string, subValue?: string }) => {
    return (
        <div className="flex items-start gap-3 rounded-lg border p-3">
            <Icon className={`h-5 w-5 mt-1 shrink-0 ${iconColor || 'text-muted-foreground'}`} />
            <div>
                <p className="text-sm text-muted-foreground">{title}</p>
                {value !== undefined && value !== null ? (
                   <p className="text-xl font-bold font-headline">
                        {typeof value === 'number' ? value.toFixed(3) : value}
                        {unit && <span className="text-sm font-normal font-body text-muted-foreground ml-1">{unit}</span>}
                    </p>
                ) : (
                     <p className="text-sm text-muted-foreground mt-2">Not available</p>
                )}
                {subValue && <p className="text-xs text-muted-foreground mt-1">{subValue}</p>}
            </div>
        </div>
    )
}

const analysisFormSchema = z.object({
  notes: z.string().optional(),
  status: z.enum(["normal" , "not_normal" , "holding_water" , "leaking"]).optional(),
  analystInitials: z.string().min(1, "Analyst initials are required."),
  disregarded: z.boolean().optional(),
});

type AnalysisFormValues = z.infer<typeof analysisFormSchema>;


function EventAnalysisDetails({ event }: { event: AnalysisPeriod }) {
  const { saveAnalysis } = useAssets();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  
  const form = useForm<AnalysisFormValues>({
      resolver: zodResolver(analysisFormSchema),
      defaultValues: {
        notes: event.analysis?.notes || "",
        status: event.analysis?.status || "normal",
        analystInitials: event.analysis?.analystInitials || "",
        disregarded: event.analysis?.disregarded || false,
      }
  });
  
  React.useEffect(() => {
    const isDisregarded = event.analysis?.disregarded || false;
    form.reset({
        notes: event.analysis?.notes || "",
        status: event.analysis?.status || "normal",
        analystInitials: event.analysis?.analystInitials || "",
        disregarded: isDisregarded,
    });
     // If automatically disregarded, don't start in editing mode
    if (isDisregarded && !event.analysis?.analystInitials) {
        setIsEditing(false);
    }

  }, [event, form]);


  const handleSave = async (data: AnalysisFormValues) => {
    setIsSaving(true);
    toast({
      title: "Saving analysis...",
    });
    
    const analysisData = {
      eventId: event.id,
      ...data,
    };

    const result = await saveAnalysis(analysisData);

    if (result?.errors) {
       const errorMessages = Object.values(result.errors).flat().join('\n');
       toast({
        variant: "destructive",
        title: "Error Saving Analysis",
        description: errorMessages
      });
    } else if (result?.message && result.message.startsWith('Error:')) {
      toast({
        variant: "destructive",
        title: "Error Saving Analysis",
        description: result.message
      });
    } else {
       toast({
        title: "Analysis Saved",
        description: `Your analysis for this event have been saved.`
      });
      setIsEditing(false);
    }

    setIsSaving(false);
  }

  const handleCancel = () => {
    form.reset();
    setIsEditing(false);
  }

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
      const diff = event.analysis.postEventElevation - event.analysis.baselineElevation;
      const margin = 0.02; // 2cm margin of error
      if (diff > margin) {
        return { 
          text: `Asset did not return to baseline (+${diff.toFixed(2)}m).`,
          icon: XCircle,
          color: "text-destructive"
        };
      }
       if (Math.abs(diff) <= margin) {
        return {
            text: "Asset returned to baseline within margin of error.",
            icon: CheckCircle,
            color: "text-green-600"
        }
      }
    }
    return {
      text: "Asset returned to pre-event baseline.",
      icon: CheckCircle,
      color: "text-green-600"
    };

  }, [event.analysis]);
  

  if (!isEditing) {
    return (
        <div className="bg-muted/30 p-4 rounded-b-md space-y-4">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
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
                        title="Time to Baseline"
                        value={event.analysis?.timeToBaseline}
                        icon={Clock}
                    />
                    <MetricCard 
                        title="Drawdown Analysis"
                        value={event.analysis?.drawdownAnalysis}
                        icon={AreaChart}
                    />

                    <div className="p-4 border bg-background rounded-lg col-span-full">
                        <Label className="font-medium text-sm mb-2">Analyst Notes</Label>
                        <p className="text-sm text-muted-foreground min-h-[40px] whitespace-pre-wrap">{event.analysis?.notes || "No notes provided."}</p>
                    </div>
                </div>
                 <div className="space-y-4">
                    <div className="p-3 border bg-background rounded-lg">
                        <p className="font-medium text-sm">Overall Assessment</p>
                        <div className={cn("flex items-center gap-2 text-sm mt-1", overallAssessment.color)}>
                            <overallAssessment.icon className="h-4 w-4 shrink-0" />
                            <p>{overallAssessment.text}</p>
                        </div>
                    </div>
                     <div className="p-3 border bg-background rounded-lg">
                        <p className="font-medium text-sm">Asset Status During Event</p>
                        <p className="text-sm capitalize text-muted-foreground mt-1">{(event.analysis?.status || 'normal').replace('_', ' ')}</p>
                    </div>
                     <div className="p-3 border bg-background rounded-lg">
                        <div className="flex justify-between items-center">
                            <p className="font-medium text-sm">Disregarded</p>
                            <span className={cn("text-sm font-semibold", event.analysis?.disregarded ? "text-destructive" : "text-muted-foreground")}>{event.analysis?.disregarded ? 'Yes' : 'No'}</span>
                        </div>
                    </div>
                     <div className="p-3 border bg-background rounded-lg">
                        <p className="font-medium text-sm">Analyst Sign-off</p>
                        <p className="text-sm font-semibold text-muted-foreground mt-1">{event.analysis?.analystInitials || 'Not reviewed'}</p>
                    </div>
                    <Button className="w-full" onClick={() => setIsEditing(true)}>
                        <Pencil className="mr-2 h-4 w-4" /> Edit Analysis
                    </Button>
                </div>
            </div>
        </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSave)}>
        <div className="bg-muted/30 p-4 rounded-b-md">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
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
                        title="Time to Baseline"
                        value={event.analysis?.timeToBaseline}
                        icon={Clock}
                    />
                    <MetricCard 
                        title="Drawdown Analysis"
                        value={event.analysis?.drawdownAnalysis}
                        icon={AreaChart}
                    />

                    <div className="p-4 border bg-background rounded-lg col-span-full">
                    <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel className="font-medium text-sm mb-2">Analyst Notes</FormLabel>
                            <FormControl>
                                <Textarea 
                                    placeholder="Add notes about this event..."
                                    className="min-h-[80px]"
                                    {...field}
                                />
                            </FormControl>
                        </FormItem>
                        )}
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
                        <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                            <FormItem className="space-y-3">
                            <FormLabel className="font-medium text-sm">Asset Status During Event</FormLabel>
                            <FormControl>
                                <RadioGroup
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                className="space-y-2"
                                >
                                <FormItem className="flex items-center space-x-2">
                                    <FormControl><RadioGroupItem value="normal" id={`status-normal-${event.id}`} /></FormControl>
                                    <Label htmlFor={`status-normal-${event.id}`} className="font-normal">Operating Normally</Label>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2">
                                    <FormControl><RadioGroupItem value="not_normal" id={`status-not-normal-${event.id}`} /></FormControl>
                                    <Label htmlFor={`status-not-normal-${event.id}`} className="font-normal">Not Operating Normally</Label>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2">
                                    <FormControl><RadioGroupItem value="holding_water" id={`status-holding-${event.id}`} /></FormControl>
                                    <Label htmlFor={`status-holding-${event.id}`} className="font-normal">Holding Water</Label>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2">
                                    <FormControl><RadioGroupItem value="leaking" id={`status-leaking-${event.id}`} /></FormControl>
                                    <Label htmlFor={`status-leaking-${event.id}`} className="font-normal">Potential Leak</Label>
                                </FormItem>
                                </RadioGroup>
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                    </div>
                    <div className="p-4 border bg-background rounded-lg">
                        <FormField
                            control={form.control}
                            name="disregarded"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between">
                                <div className="space-y-0.5">
                                    <FormLabel className="text-sm font-medium">Disregard Event</FormLabel>
                                    <p className="text-xs text-muted-foreground">Exclude this event from reports.</p>
                                </div>
                                <FormControl>
                                    <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                                </FormItem>
                            )}
                        />
                    </div>
                    <div className="p-4 border bg-background rounded-lg">
                        <FormField
                        control={form.control}
                        name="analystInitials"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel className="font-medium text-sm">Analyst Sign-off</FormLabel>
                            <div className="relative">
                                <Edit className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <FormControl>
                                    <Input 
                                        placeholder="Enter your initials..."
                                        className="pl-10"
                                        maxLength={5}
                                        {...field}
                                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                                    />
                                </FormControl>
                            </div>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button type="button" variant="secondary" className="w-full" onClick={handleCancel}>
                            <X className="mr-2 h-4 w-4" /> Cancel
                        </Button>
                        <Button type="submit" className="w-full" disabled={isSaving || !form.formState.isValid}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save Analysis
                        </Button>
                    </div>
                </div>
            </div>
        </div>
      </form>
    </Form>
  )
}


export default function AnalysisResults({ weatherSummary, onSelectEvent }: AnalysisResultsProps) {
  if (!weatherSummary || !weatherSummary.events || weatherSummary.events.length === 0) {
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
                
                const returnedToBaseline = postEventDiff !== undefined && postEventDiff <= 0.02; // 2cm margin

                const isReviewed = !!event.analysis?.analystInitials;
                const isDisregarded = !!event.analysis?.disregarded;
                    
                return (
                    <AccordionItem value={event.id} key={event.id} className={cn("border rounded-lg bg-background", isDisregarded && "bg-muted/50")}>
                        <AccordionTrigger 
                            className={cn("p-4 hover:no-underline", isDisregarded && "opacity-60")}
                            onClick={() => onSelectEvent(event.startDate, event.endDate)}
                        >
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-left flex-1 items-center text-sm">
                                 <div className="font-medium flex items-center gap-2">
                                    {isDisregarded && <EyeOff className="h-4 w-4 text-muted-foreground" title="Disregarded"/>}
                                    {isReviewed && !isDisregarded && <CheckCircle className="h-4 w-4 text-green-500" title="Reviewed"/>}
                                    {format(new Date(event.startDate), "Pp")}
                                 </div>
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
                                    !returnedToBaseline ? "text-destructive" : "text-green-600"
                                )}>
                                    <TrendingDown className="h-4 w-4" />
                                    <div className="flex flex-col items-start">
                                        <span>{event.analysis?.postEventElevation?.toFixed(2) ?? '-'} m</span>
                                        {postEventDiff !== undefined && (
                                            <span className={cn("text-xs font-mono", !returnedToBaseline ? "text-destructive/80" : "text-green-600/80")}>
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
