
"use client";

import type { Asset, OverallAnalysisData } from "@/lib/placeholder-data";
import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAssets } from "@/context/asset-context";
import { Save, Loader2, Edit, ChevronDown, DraftingCompass } from "lucide-react";

const overallAnalysisSchema = z.object({
  permanentPoolPerformance: z.enum(['sits_at_pool', 'sits_above_pool', 'sits_below_pool', 'fluctuates']).optional(),
  estimatedControlElevation: z.coerce.number().optional(),
  rainResponse: z.enum(['as_expected', 'slow_response', 'fast_response', 'no_response']).optional(),
  furtherInvestigation: z.enum(['not_needed', 'recommended', 'required']).optional(),
  summary: z.string().optional(),
  analystInitials: z.string().min(1, "Analyst initials are required."),
  status: z.enum(["ok", "warning", "error", "unknown"]),
});

type OverallAnalysisFormValues = z.infer<typeof overallAnalysisSchema>;

export default function OverallAnalysis({ asset }: { asset: Asset }) {
  const { toast } = useToast();
  const { getOverallAnalysis, saveOverallAnalysis } = useAssets();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [lastUpdated, setLastUpdated] = React.useState<string | null>(null);

  const form = useForm<OverallAnalysisFormValues>({
    resolver: zodResolver(overallAnalysisSchema),
    defaultValues: {
        permanentPoolPerformance: undefined,
        estimatedControlElevation: undefined,
        rainResponse: undefined,
        furtherInvestigation: undefined,
        summary: "",
        analystInitials: "",
        status: asset.status || 'unknown',
    },
  });

  React.useEffect(() => {
    let isMounted = true;
    const fetchAnalysis = async () => {
        setIsLoading(true);
        const data = await getOverallAnalysis(asset.id);
        if (isMounted) {
            form.reset({
                permanentPoolPerformance: data?.permanentPoolPerformance,
                estimatedControlElevation: data?.estimatedControlElevation,
                rainResponse: data?.rainResponse,
                furtherInvestigation: data?.furtherInvestigation,
                summary: data?.summary || "",
                analystInitials: data?.analystInitials || "",
                status: data?.status || asset.status || 'unknown',
            });
            if(data?.lastUpdated) {
                setLastUpdated(format(new Date(data.lastUpdated), "PPp"));
            } else {
                setLastUpdated(null);
            }
        }
        setIsLoading(false);
    }
    fetchAnalysis();
    return () => { isMounted = false };
  }, [asset.id, asset.status, getOverallAnalysis, form]);

  const handleSubmit = async (data: OverallAnalysisFormValues) => {
    setIsSubmitting(true);
    const result = await saveOverallAnalysis({ assetId: asset.id, ...data });

    if (result?.message && result.message.startsWith("Error:")) {
      toast({ variant: "destructive", title: "Error", description: result.message });
    } else {
      toast({ title: "Success", description: "Overall analysis has been saved." });
      if(result.savedData?.lastUpdated) {
        setLastUpdated(format(new Date(result.savedData.lastUpdated), "PPp"));
      }
    }
    setIsSubmitting(false);
  };

  return (
    <Card className="col-span-1 lg:col-span-4 shadow-sm">
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1" className="border-b-0">
          <AccordionTrigger className="p-6">
            <div className="flex items-start gap-4 text-left">
              <DraftingCompass className="h-6 w-6 shrink-0 text-muted-foreground" />
              <div>
                <CardTitle className="font-headline text-2xl">Overall Asset Analysis</CardTitle>
                <CardDescription className="mt-1">
                  Provide a high-level engineering assessment of the asset's performance.
                  {lastUpdated && <span className="block text-xs mt-1">Last updated: {lastUpdated}</span>}
                </CardDescription>
              </div>
            </div>
            <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-200" />
          </AccordionTrigger>
          <AccordionContent>
            <CardContent>
                {isLoading ? (
                    <div className="text-center text-muted-foreground py-8">Loading analysis...</div>
                ) : (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <FormField
                                    control={form.control}
                                    name="permanentPoolPerformance"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Permanent Pool Performance</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Select assessment..." /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="sits_at_pool">Sits at Permanent Pool</SelectItem>
                                                <SelectItem value="sits_above_pool">Sits Above Permanent Pool</SelectItem>
                                                <SelectItem value="sits_below_pool">Sits Below Permanent Pool</SelectItem>
                                                <SelectItem value="fluctuates">Fluctuates Around Pool Level</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="estimatedControlElevation"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Estimated Control Elevation (m)</FormLabel>
                                        <FormControl><Input type="number" step="0.01" placeholder="e.g., 125.42" {...field} value={field.value ?? ''} /></FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="rainResponse"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Response to Rain Events</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Select response..." /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="as_expected">As Expected</SelectItem>
                                                <SelectItem value="slow_response">Slower Than Expected</SelectItem>
                                                <SelectItem value="fast_response">Faster Than Expected</SelectItem>
                                                <SelectItem value="no_response">No Noticeable Response</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="furtherInvestigation"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Further Investigation</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Select recommendation..." /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="not_needed">Not Needed</SelectItem>
                                                <SelectItem value="recommended">Recommended</SelectItem>
                                                <SelectItem value="required">Required</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="md:col-span-2">
                                     <FormField
                                        control={form.control}
                                        name="summary"
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>Analysis Summary</FormLabel>
                                            <FormControl>
                                                <Textarea placeholder="Provide a summary of the asset's overall performance, observations, and recommendations..." className="min-h-[120px]" {...field} value={field.value ?? ''} />
                                            </FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="space-y-6">
                                    <FormField
                                        control={form.control}
                                        name="status"
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>Asset Status</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                <SelectTrigger><SelectValue placeholder="Set asset status..." /></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="unknown">Unknown</SelectItem>
                                                    <SelectItem value="ok">OK</SelectItem>
                                                    <SelectItem value="warning">Warning</SelectItem>
                                                    <SelectItem value="error">Error</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormDescription>This will update the asset's overall status badge.</FormDescription>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="analystInitials"
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>Analyst Sign-off</FormLabel>
                                            <div className="relative">
                                                <Edit className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <FormControl>
                                                    <Input
                                                        placeholder="Enter your initials..."
                                                        className="pl-10"
                                                        maxLength={5}
                                                        {...field}
                                                        value={field.value ?? ''}
                                                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                                                    />
                                                </FormControl>
                                            </div>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <Button type="submit" className="w-full" disabled={isSubmitting || !form.formState.isValid}>
                                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                        Save Overall Analysis
                                    </Button>
                                </div>
                            </div>
                        </form>
                    </Form>
                )}
            </CardContent>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}
