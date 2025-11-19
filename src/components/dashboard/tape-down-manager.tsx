
"use client";

import type { Asset, SurveyPoint, Deployment } from "@/lib/placeholder-data";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { useAssets } from "@/context/asset-context";
import { cn } from "@/lib/utils";
import { CalendarIcon, PlusCircle, Ruler, ChevronDown, Clock } from "lucide-react";

const tapeDownSchema = z.object({
  deploymentId: z.string({ required_error: "A deployment must be selected." }),
  date: z.date({ required_error: "A date is required." }),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid time format. Use HH:MM" }),
  measurement: z.coerce.number({ required_error: "A measurement is required." }),
});

type TapeDownFormValues = z.infer<typeof tapeDownSchema>;


export default function TapeDownManager({ asset, deployments }: { asset: Asset; deployments: Deployment[] }) {
  const { toast } = useToast();
  const { addSurveyPoint } = useAssets();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  const eligibleDeployments = React.useMemo(() => {
    return deployments.filter(d => typeof d.stillwellTop === 'number');
  }, [deployments]);

  const form = useForm<TapeDownFormValues>({
    resolver: zodResolver(tapeDownSchema),
    defaultValues: {
      time: "12:00",
    }
  });
  
  const selectedDeploymentId = form.watch('deploymentId');
  const selectedDeployment = eligibleDeployments.find(d => d.id === selectedDeploymentId);

  const handleSubmit = async (data: TapeDownFormValues) => {
    if (!selectedDeployment || typeof selectedDeployment.stillwellTop !== 'number') {
        toast({ variant: "destructive", title: "Error", description: "Selected deployment does not have a valid stillwell top elevation." });
        return;
    }
    
    setIsSubmitting(true);

    const [hours, minutes] = data.time.split(':').map(Number);
    const combinedDateTime = new Date(data.date);
    combinedDateTime.setHours(hours, minutes, 0, 0);
    
    const calculatedElevation = selectedDeployment.stillwellTop - data.measurement;

    const serverData = {
      timestamp: combinedDateTime.toISOString(),
      elevation: calculatedElevation
    };

    const result = await addSurveyPoint(asset.id, serverData);
    
    if (result?.message && result.message.startsWith('Error:')) {
      toast({ variant: "destructive", title: "Error", description: result.message });
    } else {
      toast({ 
        title: "Success", 
        description: `Tape-down recorded as survey point with elevation ${calculatedElevation.toFixed(2)}m.` 
      });
      form.reset({ deploymentId: data.deploymentId, time: "12:00" });
    }
    
    setIsSubmitting(false);
  };


  return (
    <Card className="col-span-1 lg:col-span-4 shadow-sm">
      <Accordion type="single" collapsible defaultValue="item-1">
        <AccordionItem value="item-1" className="border-b-0">
          <AccordionTrigger className="p-6">
            <div className="flex items-start gap-4 text-left">
              <Ruler className="h-6 w-6 shrink-0 text-muted-foreground" />
              <div>
                <CardTitle className="font-headline text-2xl">Tape-Down Measurements</CardTitle>
                <CardDescription className="mt-1">
                  Record a water elevation by measuring the distance down from a surveyed stillwell top.
                </CardDescription>
              </div>
            </div>
            <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-200" />
          </AccordionTrigger>
          <AccordionContent>
            <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="flex items-end gap-4">
                    <FormField
                      control={form.control}
                      name="deploymentId"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Stillwell / Deployment</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={eligibleDeployments.length === 0}>
                            <FormControl>
                                <SelectTrigger className="w-[240px]">
                                <SelectValue placeholder={eligibleDeployments.length > 0 ? "Select a stillwell..." : "No stillwells available"} />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {eligibleDeployments.map(d => (
                                    <SelectItem key={d.id} value={d.id}>
                                        {d.name} (Top: {d.stillwellTop?.toFixed(2)}m)
                                    </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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
                              <Input type="text" placeholder="HH:MM" className="w-[130px] pl-10" {...field} />
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="measurement"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tape-Down (m)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="e.g., 0.8" className="w-[180px]" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={isSubmitting || !form.formState.isValid}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      {isSubmitting ? "Adding..." : "Add Checkpoint"}
                    </Button>
                  </form>
                </Form>
                 {selectedDeploymentId && (
                    <div className="mt-4 text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                        Calculation Preview: Water Elevation = {selectedDeployment?.stillwellTop?.toFixed(2) || '...'}m (Stillwell Top) - {form.getValues('measurement') || 0}m (Tape-Down) = <span className="font-bold text-foreground">{((selectedDeployment?.stillwellTop || 0) - (form.getValues('measurement') || 0)).toFixed(2)}m</span>
                    </div>
                )}
            </CardContent>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}
