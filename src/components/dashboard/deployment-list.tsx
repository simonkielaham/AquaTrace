
"use client";

import type { Deployment, Asset } from "@/lib/placeholder-data";
import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

import { ScrollArea } from "@/components/ui/scroll-area";
import { PlusCircle, Save, ChevronDown, CalendarIcon, Download } from "lucide-react";
import { Button } from "../ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAssets } from "@/context/asset-context";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

// Schemas for forms
const editDeploymentSchema = z.object({
  name: z.string().optional(),
  sensorId: z.string().min(1, "Sensor ID is required."),
  sensorElevation: z.coerce.number(),
});

type EditDeploymentValues = z.infer<typeof editDeploymentSchema>;

const deploymentFormSchema = z.object({
  sensorId: z.string().min(1, "Sensor ID is required."),
  sensorElevation: z.coerce.number(),
  name: z.string().optional(),
});
type DeploymentFormValues = z.infer<typeof deploymentFormSchema>;


function NewDeploymentDialog({ asset }: { asset: Asset }) {
  const { toast } = useToast();
  const { createDeployment } = useAssets();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<DeploymentFormValues>({
    resolver: zodResolver(deploymentFormSchema),
    defaultValues: {
      sensorId: "",
      sensorElevation: 0,
      name: "",
    }
  });

  const handleSubmit = async (data: DeploymentFormValues) => {
    setIsSubmitting(true);
    const result = await createDeployment(asset.id, data);
    if (result?.message && result.message.startsWith('Error:')) {
      toast({ variant: "destructive", title: "Error", description: <pre className="mt-2 w-full max-w-[550px] whitespace-pre-wrap break-all rounded-md bg-slate-950 p-4"><code className="text-white">{result.message}</code></pre> });
    } else {
      toast({ title: "Success", description: "New deployment created." });
      setIsOpen(false);
      form.reset();
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PlusCircle className="mr-2 h-4 w-4" />
          New Deployment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Deployment</DialogTitle>
          <DialogDescription>
            Add a new sensor deployment for {asset.name}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deployment Name (Optional)</FormLabel>
                  <FormControl><Input placeholder="e.g., Initial Deployment" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sensorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sensor ID</FormLabel>
                  <FormControl><Input placeholder="e.g., SN-12345" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sensorElevation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sensor Elevation (m)</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Deployment"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}


function EditDeploymentForm({ deployment, asset }: { deployment: Deployment, asset: Asset }) {
  const { toast } = useToast();
  const { updateDeployment } = useAssets();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<EditDeploymentValues>({
    resolver: zodResolver(editDeploymentSchema),
    defaultValues: {
      name: deployment.name || "",
      sensorId: deployment.sensorId,
      sensorElevation: deployment.sensorElevation,
    },
  });

  const onSubmit = async (data: EditDeploymentValues) => {
    setIsSubmitting(true);
    const result = await updateDeployment(deployment.id, asset.id, data);
    
    if (result?.message && result.message.startsWith('Error:')) {
      toast({ 
        variant: "destructive", 
        title: "Error Updating Deployment", 
        description: <pre className="mt-2 w-full max-w-[550px] whitespace-pre-wrap break-all rounded-md bg-slate-950 p-4"><code className="text-white">{result.message}</code></pre>
      });
    } else {
      toast({ title: "Success", description: "Deployment updated." });
    }
    
    setIsSubmitting(false);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deployment Name</FormLabel>
                  <FormDescription>A name for this deployment.</FormDescription>
                  <FormControl><Input {...field} placeholder="e.g., Initial Deployment" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          <FormField
            control={form.control}
            name="sensorId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sensor ID</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="sensorElevation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sensor Elevation (m)</FormLabel>
                <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Button type="submit" size="sm" disabled={isSubmitting}>
          <Save className="mr-2 h-4 w-4" />
          {isSubmitting ? "Saving..." : "Save Changes"}
        </Button>
      </form>
    </Form>
  );
}


export default function DeploymentList({ deployments, asset }: { deployments: Deployment[], asset: Asset }) {
  const { toast } = useToast();
  const { downloadLogs } = useAssets();
  
  const handleDownloadLogs = async () => {
    toast({ title: "Generating log file..." });
    const result = await downloadLogs(asset.id);

    if (result.message && !result.logs) {
      toast({ variant: "destructive", title: "Error", description: result.message });
      return;
    }
    
    if(result.logs) {
      const blob = new Blob([result.logs], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${asset.name.replace(/\s+/g, '_')}_activity_log_${new Date().toISOString()}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "Success", description: "Log file downloaded." });
    }
  };

  const formattedDeployments = React.useMemo(() => {
    return deployments.map(d => {
      return {
        ...d,
        dateRangeLabel: d.name || `Deployment (ID: ${d.id.substring(0, 4)})`,
      };
    });
  }, [deployments]);


  return (
    <Card className="col-span-1 lg:col-span-2 shadow-sm flex flex-col">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="grid gap-2">
            <CardTitle className="font-headline">Deployments</CardTitle>
            <CardDescription>
              Manage sensor deployments for this asset.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadLogs}>
              <Download className="mr-2 h-4 w-4" />
              Download Log
            </Button>
            <NewDeploymentDialog asset={asset} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <ScrollArea className="h-[280px]">
          <Accordion type="multiple" className="w-full">
            {formattedDeployments.map((deployment) => (
              <AccordionItem value={deployment.id} key={deployment.id}>
                <AccordionTrigger>
                   <div className="flex items-center gap-2 text-left">
                    <CalendarIcon className="h-4 w-4 shrink-0" />
                    <span className="font-semibold">{deployment.dateRangeLabel}</span>
                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                   </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-6 pl-2">
                    <EditDeploymentForm deployment={deployment} asset={asset} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
             {formattedDeployments.length === 0 && (
                <div className="text-center text-muted-foreground pt-8">
                    No deployments for this asset yet.
                </div>
            )}
          </Accordion>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

    

    

