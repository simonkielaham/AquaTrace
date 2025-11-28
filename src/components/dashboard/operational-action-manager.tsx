"use client";

import type { Asset, Deployment, OperationalAction } from "@/lib/placeholder-data";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAssets } from "@/context/asset-context";
import { cn } from "@/lib/utils";
import { CalendarIcon, PlusCircle, Trash2, Loader2, Clock, ChevronDown, Settings } from "lucide-react";

const operationalActionSchema = z.object({
  deploymentId: z.string({ required_error: "A deployment must be selected." }).min(1, "A deployment must be selected."),
  date: z.date({ required_error: "A date is required." }),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid time format. Use HH:MM" }),
  action: z.string().min(3, "An action description of at least 3 characters is required."),
});

type OperationalActionFormValues = z.infer<typeof operationalActionSchema>;

interface OperationalActionManagerProps {
    asset: Asset;
    deployments: Deployment[];
    operationalActions: OperationalAction[];
    loading: boolean;
}

export default function OperationalActionManager({ asset, deployments, operationalActions, loading }: OperationalActionManagerProps) {
  const { toast } = useToast();
  const { addOperationalAction, deleteOperationalAction } = useAssets();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState('');

  const form = useForm<OperationalActionFormValues>({
    resolver: zodResolver(operationalActionSchema),
    defaultValues: {
      time: "12:00",
    }
  });
  
  const sortedActions = React.useMemo(() => {
    return [...operationalActions].sort((a,b) => b.timestamp - a.timestamp);
  }, [operationalActions]);


  const handleSubmit = async (data: OperationalActionFormValues) => {
    setIsSubmitting(true);

    const [hours, minutes] = data.time.split(':').map(Number);
    const combinedDateTime = new Date(data.date);
    combinedDateTime.setHours(hours, minutes, 0, 0);

    const serverData = {
      timestamp: combinedDateTime.toISOString(),
      action: data.action,
      deploymentId: data.deploymentId,
    };

    const result = await addOperationalAction(serverData);
    
    if (result?.message && result.message.startsWith('Error:')) {
      toast({ variant: "destructive", title: "Error", description: result.message });
    } else {
      toast({ title: "Success", description: "Operational action logged." });
      form.reset({ time: "12:00", date: undefined, action: "" });
    }
    
    setIsSubmitting(false);
  };

  const handleDelete = async (deploymentId: string, actionId: string) => {
    setIsDeleting(actionId);
    const result = await deleteOperationalAction(deploymentId, actionId);
     if (result?.message && result.message.startsWith('Error:')) {
      toast({ variant: "destructive", title: "Error", description: result.message });
    } else {
      toast({ title: "Success", description: "Operational action deleted." });
    }
    setIsDeleting('');
  }

  return (
    <Card className="col-span-1 lg:col-span-4 shadow-sm">
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1" className="border-b-0">
          <AccordionTrigger className="p-6">
            <div className="flex items-start gap-4 text-left">
              <Settings className="h-6 w-6 shrink-0 text-muted-foreground" />
              <div>
                <CardTitle className="font-headline text-2xl">Operational Log</CardTitle>
                <CardDescription className="mt-1">
                  Log operational actions like valve changes or debris clearing to plot them on the chart.
                </CardDescription>
              </div>
            </div>
            <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-200" />
          </AccordionTrigger>
          <AccordionContent>
            <CardContent className="space-y-8">
              <div className="space-y-4">
                <h4 className="font-medium">Log New Action</h4>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 items-end gap-4">
                     <FormField
                        control={form.control}
                        name="deploymentId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Deployment</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                  <SelectTrigger>
                                  <SelectValue placeholder={deployments.length > 0 ? "Select a deployment..." : "No deployments for this asset"} />
                                  </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                  {deployments.map(d => (
                                      <SelectItem key={d.id} value={d.id}>
                                          {d.name}
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
                                    "w-full pl-3 text-left font-normal",
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
                              <Input type="text" placeholder="HH:MM" className="w-full pl-10" {...field} />
                            </FormControl>
                            </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="action"
                      render={({ field }) => (
                        <FormItem className="flex-1 min-w-[200px]">
                          <FormLabel>Action Description</FormLabel>
                          <FormControl>
                            <Input type="text" placeholder="e.g., Opened outlet valve" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={isSubmitting || !form.formState.isValid} className="w-full lg:w-auto">
                      <PlusCircle className="mr-2 h-4 w-4" />
                      {isSubmitting ? "Logging..." : "Log Action"}
                    </Button>
                  </form>
                </Form>
              </div>
              <div className="space-y-4">
                <h4 className="font-medium">Logged Actions</h4>
                <ScrollArea className="h-[250px] rounded-md border">
                    {loading ? (
                      <div className="p-4 text-center text-muted-foreground">Loading actions...</div>
                    ) : sortedActions.length === 0 ? (
                      <p className="p-4 text-center text-sm text-muted-foreground">No operational actions logged yet.</p>
                    ) : (
                      <Table>
                          <TableHeader>
                          <TableRow>
                              <TableHead>Timestamp</TableHead>
                              <TableHead>Action</TableHead>
                              <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                          </TableHeader>
                          <TableBody>
                          {sortedActions.map((action) => (
                              <TableRow key={action.id}>
                              <TableCell>{format(new Date(action.timestamp), "Pp")}</TableCell>
                              <TableCell>{action.action}</TableCell>
                              <TableCell className="text-right">
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      onClick={() => handleDelete(action.deploymentId!, action.id)}
                                      disabled={!!isDeleting}
                                      title="Delete operational action"
                                  >
                                      {isDeleting === action.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
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
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}
