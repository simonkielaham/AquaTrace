
"use client";

import type { Asset, SurveyPoint, DataPoint } from "@/lib/placeholder-data";
import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAssets } from "@/context/asset-context";
import { cn } from "@/lib/utils";
import { CalendarIcon, PlusCircle, Trash2, Loader2, Clock } from "lucide-react";
import { getProcessedData as getProcessedDataAction } from "@/app/actions";

const surveyPointSchema = z.object({
  date: z.date({ required_error: "A date is required." }),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid time format. Use HH:MM" }),
  elevation: z.coerce.number({ required_error: "An elevation is required." }),
});

type SurveyPointFormValues = z.infer<typeof surveyPointSchema>;

type EnrichedSurveyPoint = SurveyPoint & {
    sensorTimestamp?: number;
    sensorElevation?: number;
    difference?: number;
}

export default function SurveyPointManager({ asset, dataVersion }: { asset: Asset; dataVersion: number }) {
  const { toast } = useToast();
  const { addSurveyPoint, getSurveyPoints, deleteSurveyPoint } = useAssets();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState('');
  const [surveyPoints, setSurveyPoints] = React.useState<EnrichedSurveyPoint[]>([]);
  const [loadingPoints, setLoadingPoints] = React.useState(true);

  const form = useForm<SurveyPointFormValues>({
    resolver: zodResolver(surveyPointSchema),
    defaultValues: {
      time: "12:00",
    }
  });

  React.useEffect(() => {
    let isMounted = true;
    const fetchAndEnrichPoints = async () => {
        setLoadingPoints(true);
        try {
            const [points, processedData] = await Promise.all([
                getSurveyPoints(asset.id),
                getProcessedDataAction(asset.id)
            ]);

            if (isMounted) {
                 const enrichedPoints: EnrichedSurveyPoint[] = points.map(point => {
                    if (processedData.length === 0) {
                        return { ...point };
                    }
                    
                    // Find the nearest processed data point
                    let nearestPoint: DataPoint | null = null;
                    if (processedData.length > 0) {
                      nearestPoint = processedData[0];
                      let smallestDiff = Math.abs(point.timestamp - nearestPoint.timestamp);

                      for (const p of processedData) {
                          const diff = Math.abs(point.timestamp - p.timestamp);
                          if (diff < smallestDiff) {
                              smallestDiff = diff;
                              nearestPoint = p;
                          }
                      }
                    }
                    
                    if (nearestPoint) {
                        return {
                            ...point,
                            sensorTimestamp: nearestPoint.timestamp,
                            sensorElevation: nearestPoint.waterLevel,
                            difference: point.elevation - nearestPoint.waterLevel,
                        };
                    }

                    return { ...point };
                });
                
                setSurveyPoints(enrichedPoints);
            }
        } catch (error) {
            console.error("Failed to fetch or enrich survey points:", error);
            if (isMounted) {
                // If it fails, at least try to show the raw points
                getSurveyPoints(asset.id).then(points => setSurveyPoints(points));
            }
        } finally {
             if (isMounted) setLoadingPoints(false);
        }
    }

    fetchAndEnrichPoints();
    
    return () => { isMounted = false; };
  }, [asset.id, dataVersion, getSurveyPoints]);


  const handleSubmit = async (data: SurveyPointFormValues) => {
    setIsSubmitting(true);

    const [hours, minutes] = data.time.split(':').map(Number);
    const combinedDateTime = new Date(data.date);
    combinedDateTime.setHours(hours, minutes, 0, 0);

    const serverData = {
      timestamp: combinedDateTime.toISOString(),
      elevation: data.elevation
    };

    const result = await addSurveyPoint(asset.id, serverData);
    
    if (result?.message && result.message.startsWith('Error:')) {
      toast({ variant: "destructive", title: "Error", description: result.message });
    } else {
      toast({ title: "Success", description: "Survey point added." });
      form.reset({ time: "12:00" });
    }
    
    setIsSubmitting(false);
  };

  const handleDelete = async (pointId: string) => {
    setIsDeleting(pointId);
    const result = await deleteSurveyPoint(pointId);
     if (result?.message && result.message.startsWith('Error:')) {
      toast({ variant: "destructive", title: "Error", description: result.message });
    } else {
      toast({ title: "Success", description: "Survey point deleted." });
    }
    setIsDeleting('');
  }

  return (
    <Card className="col-span-1 lg:col-span-4 shadow-sm">
      <CardHeader>
        <CardTitle className="font-headline">Manual Survey Points</CardTitle>
        <CardDescription>
          Add and manage manual survey elevation points for this asset.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h4 className="font-medium mb-4">Add New Point</h4>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="flex gap-4">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-[240px] pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date > new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="time"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Time (24h)</FormLabel>
                       <div className="relative">
                         <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl>
                          <Input type="time" className="w-[120px] pl-10" {...field} />
                        </FormControl>
                       </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="elevation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Elevation (m)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="e.g., 125.42" className="w-[240px]" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isSubmitting}>
                <PlusCircle className="mr-2 h-4 w-4" />
                {isSubmitting ? "Adding..." : "Add Point"}
              </Button>
            </form>
          </Form>
        </div>
        <div>
          <h4 className="font-medium mb-4">Existing Points</h4>
          <ScrollArea className="h-[250px] rounded-md border">
             {loadingPoints ? (
                <div className="p-4 text-center text-muted-foreground">Loading points...</div>
             ) : surveyPoints.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">No manual points added yet.</p>
             ) : (
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Survey Datetime</TableHead>
                        <TableHead>Survey Elevation</TableHead>
                        <TableHead>Sensor Datetime</TableHead>
                        <TableHead>Sensor Elevation</TableHead>
                        <TableHead>Difference</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {surveyPoints.map((point) => (
                        <TableRow key={point.id}>
                        <TableCell>{format(new Date(point.timestamp), "Pp")}</TableCell>
                        <TableCell>{point.elevation.toFixed(2)}m</TableCell>
                        <TableCell>
                          {point.sensorTimestamp ? format(new Date(point.sensorTimestamp), "Pp") : <span className="text-muted-foreground text-xs">N/A</span>}
                        </TableCell>
                         <TableCell>
                          {point.sensorElevation !== undefined ? `${point.sensorElevation.toFixed(2)}m` : <span className="text-muted-foreground text-xs">N/A</span>}
                        </TableCell>
                        <TableCell>
                            {point.difference !== undefined ? (
                                <span className={cn(
                                    "font-mono text-xs",
                                    point.difference > 0.01 ? "text-green-600" :
                                    point.difference < -0.01 ? "text-red-600" :
                                    "text-muted-foreground"
                                )}>
                                    {point.difference > 0 ? '+' : ''}{point.difference.toFixed(2)}m
                                </span>
                            ) : (
                                <span className="text-muted-foreground text-xs">N/A</span>
                            )}
                        </TableCell>
                        <TableCell className="text-right">
                             <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleDelete(point.id)}
                                disabled={!!isDeleting}
                                title="Delete survey point"
                            >
                                {isDeleting === point.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                            </Button>
                        </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
             )}
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}

    