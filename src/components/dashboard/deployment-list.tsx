
"use client";

import type { Deployment, Asset, DataFile } from "@/lib/placeholder-data";
import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import Papa from "papaparse";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
import { PlusCircle, Save, ChevronDown, CalendarIcon, Download, FileUp, AlertCircle } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


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

const addDatafileSchema = z.object({
  datetimeColumn: z.string().min(1, "Please select the date/time column."),
  waterLevelColumn: z.string().min(1, "Please select the water level column."),
  startRow: z.coerce.number().min(2, "Start row must be at least 2."),
});
type AddDatafileValues = z.infer<typeof addDatafileSchema>;


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
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deployment Name</FormLabel>
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
      
      <div className="space-y-2">
         <div className="flex justify-between items-center">
            <h4 className="font-medium">Datafiles</h4>
            <AddDatafileDialog deployment={deployment} />
        </div>
        <DatafileList files={deployment.files} />
      </div>
    </div>
  );
}


function AddDatafileDialog({ deployment }: { deployment: Deployment }) {
  const { toast } = useToast();
  const { addDatafile } = useAssets();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [fileContent, setFileContent] = React.useState<string | null>(null);
  const [csvHeaders, setCsvHeaders] = React.useState<string[]>([]);
  const [log, setLog] = React.useState<string[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<AddDatafileValues>({
    resolver: zodResolver(addDatafileSchema),
    defaultValues: { startRow: 2, datetimeColumn: undefined, waterLevelColumn: undefined },
  });

  const appendLog = (message: string) => {
    setLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };
  
  const resetDialogState = () => {
    setFile(null);
    setFileContent(null);
    setCsvHeaders([]);
    setLog([]);
    form.reset({ startRow: 2, datetimeColumn: undefined, waterLevelColumn: undefined });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Use a timeout to prevent the state from being cleared before the dialog closes
      setTimeout(resetDialogState, 200);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      appendLog(`File selected: ${selectedFile.name}`);
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setFileContent(content);
        Papa.parse(content, {
          header: true,
          preview: 1,
          skipEmptyLines: true,
          complete: (results) => {
            setCsvHeaders(results.meta.fields || []);
            appendLog(`Detected headers: ${results.meta.fields?.join(', ')}`);
          },
        });
      };
      reader.readAsText(selectedFile);
    }
  };

  const handleSubmit = async (data: AddDatafileValues) => {
    if (!file || !fileContent) {
      toast({ variant: "destructive", title: "No file selected", description: "Please select a CSV file to upload." });
      return;
    }

    setIsSubmitting(true);
    setLog([]);
    appendLog("Initiating submission...");

    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileContent', fileContent);
    formData.append('deploymentId', deployment.id);
    formData.append('assetId', deployment.assetId);
    Object.entries(data).forEach(([key, value]) => {
      formData.append(key, String(value));
    });

    appendLog("Client-side validation complete.");
    appendLog(`File: ${file.name}, Start Row: ${data.startRow}`);
    appendLog(`Payload sent to server: ${JSON.stringify(data)}`);
    appendLog("Sending data to server...");
    
    const result = await addDatafile(formData);

    appendLog("Server responded.");

    if (result?.message && result.message.startsWith('Error:')) {
      appendLog(`SERVER ERROR: ${result.message}`);
      toast({ variant: "destructive", title: "Error Uploading File", description: "See submission log for details." });
    } else {
      appendLog("Upload successful!");
      toast({ title: "File Uploaded", description: `${file.name} has been processed.` });
      handleOpenChange(false);
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><FileUp className="mr-2 h-4 w-4" /> Add Datafile</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[725px]">
        <DialogHeader>
          <DialogTitle>Add Datafile to {deployment.name}</DialogTitle>
          <DialogDescription>Upload a CSV file and map the columns for processing.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="space-y-4">
               <FormItem>
                <FormLabel>CSV File</FormLabel>
                <FormControl>
                  <Input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} />
                </FormControl>
                <FormMessage />
              </FormItem>

              {csvHeaders.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="datetimeColumn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date/Time Column</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                           <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select a column..." /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {csvHeaders.map(header => <SelectItem key={header} value={header}>{header}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="waterLevelColumn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Water Level Column</FormLabel>
                         <Select onValueChange={field.onChange} value={field.value}>
                           <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select a column..." /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {csvHeaders.map(header => <SelectItem key={header} value={header}>{header}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   <FormField
                      control={form.control}
                      name="startRow"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data Start Row</FormLabel>
                          <FormControl><Input type="number" {...field} /></FormControl>
                          <FormDescription>The row number where the actual data begins (usually 2).</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </div>
              )}
            </div>

            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting || !file}>
                {isSubmitting ? "Processing..." : "Save Datafile"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
        {log.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium">Submission Log</p>
            <ScrollArea className="h-24 w-full rounded-md border p-2">
              <pre className="text-xs whitespace-pre-wrap">
                {log.join('\n')}
              </pre>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DatafileList({ files }: { files?: DataFile[] }) {
  if (!files || files.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground border-dashed border-2 rounded-lg p-6">
        <p>No datafiles have been uploaded for this deployment yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Filename</TableHead>
            <TableHead>Date Range</TableHead>
            <TableHead className="text-right">Rows</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map(file => (
            <TableRow key={file.id}>
              <TableCell className="font-medium">{file.filename}</TableCell>
              <TableCell>{new Date(file.startDate).toLocaleDateString()} - {new Date(file.endDate).toLocaleDateString()}</TableCell>
              <TableCell className="text-right">{file.rowCount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
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
      const dateRange = d.files && d.files.length > 0
        ? `${new Date(d.files[0].startDate).toLocaleDateString()} - ${new Date(d.files[d.files.length-1].endDate).toLocaleDateString()}`
        : 'No data';
      return {
        ...d,
        dateRangeLabel: d.name || `Deployment (ID: ${d.id.substring(0, 4)})`,
        dateRange: dateRange,
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
              Manage sensor deployments and their associated datafiles.
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

    