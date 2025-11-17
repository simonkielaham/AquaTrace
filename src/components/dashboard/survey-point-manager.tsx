
"use client";

import type { Asset, SurveyPoint } from "@/lib/placeholder-data";
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
import { CalendarIcon, PlusCircle, Trash2, Loader2 } from "lucide-react";

const surveyPointSchema = z.object({
  date: z.date({ required_error: "A date is required." }),
  elevation: z.coerce.number({ required_error: "An elevation is required." }),
});

type SurveyPointFormValues = z.infer<typeof surveyPointSchema>;

export default function SurveyPointManager({ asset, dataVersion }: { asset: Asset; dataVersion: number }) {
  const { toast } = useToast();
  const { addSurveyPoint, getSurveyPoints, deleteSurveyPoint } = useAssets();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState('');
  const [surveyPoints, setSurveyPoints] = React.useState<SurveyPoint[]>([]);
  const [loadingPoints, setLoadingPoints] = React.useState(true);

  const form = useForm<SurveyPointFormValues>({
    resolver: zodResolver(surveyPointSchema),
  });

  React.useEffect(() => {
    let isMounted = true;
    setLoadingPoints(true);
    getSurveyPoints(asset.id).then(points => {
      if (isMounted) {
        setSurveyPoints(points);
        setLoadingPoints(false);
      }
    });
    return () => { isMounted = false; };
  }, [asset.id, dataVersion, getSurveyPoints]);


  const handleSubmit = async (data: SurveyPointFormValues) => {
    setIsSubmitting(true);

    // Format the date to yyyy-MM-dd for the server action
    const serverData = {
      date: format(data.date, 'yyyy-MM-dd'),
      elevation: data.elevation
    };

    const result = await addSurveyPoint(asset.id, serverData);
    
    if (result?.message && result.message.startsWith('Error:')) {
      toast({ variant: "destructive", title: "Error", description: result.message });
    } else {
      toast({ title: "Success", description: "Survey point added." });
      form.reset();
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
                        <TableHead>Date</TableHead>
                        <TableHead>Elevation</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {surveyPoints.map((point) => (
                        <TableRow key={point.id}>
                        <TableCell>{format(new Date(point.timestamp), "PPP")}</TableCell>
                        <TableCell>{point.elevation.toFixed(2)}m</TableCell>
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
