

"use client";

import type { Deployment, Asset, DataFile, StagedFile } from "@/lib/placeholder-data";
import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
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
import { PlusCircle, Save, ChevronDown, CalendarIcon, Download, FileUp, Files, Trash2, Loader2, Database, Droplets, Undo2, Edit, Wind } from "lucide-react";
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
import { Label } from "@/components/ui/label";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Papa from "papaparse";

// Schemas for forms
const editDeploymentSchema = z.object({
  name: z.string().optional(),
  sensorId: z.string().min(1, "Sensor ID is required."),
  sensorElevation: z.coerce.number(),
  stillwellTop: z.coerce.number().optional().nullable(),
  designDrawdown: z.coerce.number().optional(),
});

type EditDeploymentValues = z.infer<typeof editDeploymentSchema>;

const deploymentFormSchema = z.object({
  sensorId: z.string().min(1, "Sensor ID is required."),
  sensorElevation: z.coerce.number(),
  stillwellTop: z.coerce.number().optional().nullable(),
  name: z.string().optional(),
  designDrawdown: z.coerce.number().optional(),
});
type DeploymentFormValues = z.infer<typeof deploymentFormSchema>;

const baseDatafileSchema = z.object({
  dataType: z.enum(['water-level', 'precipitation', 'sensor-suite'], { required_error: "Please select a data type."}),
  datetimeColumn: z.string({ required_error: "Please select the date/time column."}).min(1, "Please select the date/time column."),
  waterLevelColumn: z.string().optional(),
  precipitationColumn: z.string().optional(),
  sensorPressureColumn: z.string().optional(),
  temperatureColumn: z.string().optional(),
  barometerColumn: z.string().optional(),
  startRow: z.coerce.number().min(1, "Start row must be at least 1."),
});

const refinedDatafileSchema = baseDatafileSchema.refine(data => {
    if (data.dataType === 'water-level') return !!data.waterLevelColumn && data.waterLevelColumn !== 'none';
    if (data.dataType === 'precipitation') return !!data.precipitationColumn && data.precipitationColumn !== 'none';
    if (data.dataType === 'sensor-suite') return !!data.waterLevelColumn && data.waterLevelColumn !== 'none';
    return true;
}, {
    message: "A primary value column is required for the selected data type.",
    path: ["waterLevelColumn"],
});

const assignDatafileSchema = baseDatafileSchema.extend({
  filename: z.string({ required_error: "Please select a file to assign."}).min(1, "Please select a file to assign."),
}).refine(data => {
    if (data.dataType === 'water-level') return !!data.waterLevelColumn && data.waterLevelColumn !== 'none';
    if (data.dataType === 'precipitation') return !!data.precipitationColumn && data.precipitationColumn !== 'none';
    if (data.dataType === 'sensor-suite') return !!data.waterLevelColumn && data.waterLevelColumn !== 'none';
    return true;
}, {
    message: "A primary value column is required for the selected data type.",
    path: ["waterLevelColumn"],
});

const getIntelligentMapping = (headers: string[]): Partial<z.infer<typeof baseDatafileSchema>> => {
    const mapping: Partial<z.infer<typeof baseDatafileSchema>> = {};
    const lowerCaseHeaders = headers.map(h => h.toLowerCase());

    const findMatch = (keywords: string[]): string | undefined => {
        for (const keyword of keywords) {
            const exactMatchIndex = lowerCaseHeaders.findIndex(h => h === keyword);
            if (exactMatchIndex !== -1) return headers[exactMatchIndex];
        }
        for (const keyword of keywords) {
            const partialMatchIndex = lowerCaseHeaders.findIndex(h => h.includes(keyword));
            if (partialMatchIndex !== -1) return headers[partialMatchIndex];
        }
        return undefined;
    };

    mapping.datetimeColumn = findMatch(['date', 'time', 'timestamp', 'date-time']);
    mapping.waterLevelColumn = findMatch(['waterlevel', 'water level', 'level', 'wl']);
    mapping.precipitationColumn = findMatch(['precipitation', 'rain', 'precip']);
    mapping.sensorPressureColumn = findMatch(['sensor pressure', 'absolute pressure', 'abs pressure', 'pressure']);
    mapping.temperatureColumn = findMatch(['temperature', 'temp']);
    mapping.barometerColumn = findMatch(['barometer', 'baro']);

    return mapping;
}

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
      stillwellTop: null,
      name: "",
      designDrawdown: 48,
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
                  <FormControl><Input placeholder="e.g., Initial Deployment" {...field} value={field.value ?? ''} /></FormControl>
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
             <div className="grid grid-cols-2 gap-4">
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
                 <FormField
                  control={form.control}
                  name="stillwellTop"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stillwell Top (m)</FormLabel>
                      <FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
             <FormField
                  control={form.control}
                  name="designDrawdown"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Design Drawdown Time (hr)</FormLabel>
                      <FormControl><Input type="number" step="1" {...field} value={field.value ?? ''} /></FormControl>
                      <FormDescription>e.g., 24, 48, or 72 hours</FormDescription>
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
      stillwellTop: deployment.stillwellTop === null || deployment.stillwellTop === undefined ? null : deployment.stillwellTop,
      designDrawdown: deployment.designDrawdown || 48,
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
                    <FormControl><Input {...field} placeholder="e.g., Initial Deployment" value={field.value ?? ''} /></FormControl>
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
             <FormField
              control={form.control}
              name="stillwellTop"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stillwell Top (m)</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
           <FormField
              control={form.control}
              name="designDrawdown"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Design Drawdown Time (hr)</FormLabel>
                  <FormControl><Input type="number" step="1" {...field} value={field.value ?? ''} /></FormControl>
                  <FormDescription>e.g., 24, 48, or 72 hours</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          <Button type="submit" size="sm" disabled={isSubmitting}>
            <Save className="mr-2 h-4 w-4" />
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </Form>
      
      <div className="space-y-2">
         <div className="flex justify-between items-center">
            <h4 className="font-medium">Datafiles</h4>
            <AssignDatafileDialog deployment={deployment} />
        </div>
        <DatafileList deployment={deployment} />
      </div>
    </div>
  );
}

function DatafileFormContent({ form, csvHeaders, csvSample, isParsing, loadingStagedFiles, stagedFiles, onFileSelect }: {
    form: any,
    csvHeaders: string[],
    csvSample: string[][],
    isParsing: boolean,
    loadingStagedFiles?: boolean,
    stagedFiles?: StagedFile[],
    onFileSelect?: (filename: string) => void,
}) {
    const startRow = useWatch({ control: form.control, name: 'startRow' });
    const dataType = form.watch('dataType');
    const selectedFilename = form.watch("filename");

    const currentPreviewRow = React.useMemo(() => {
        const rowIndex = startRow - 1; // startRow is 1-based
        if (csvSample && rowIndex >= 0 && rowIndex < csvSample.length) {
            return csvSample[rowIndex];
        }
        return null;
    }, [startRow, csvSample]);
    
    return (
        <div className="space-y-6">
            {onFileSelect && stagedFiles && (
                 <FormField
                    control={form.control}
                    name="filename"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Staged File</FormLabel>
                        <Select onValueChange={(value) => {
                            field.onChange(value);
                            if(onFileSelect) onFileSelect(value);
                        }} value={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder={loadingStagedFiles ? "Loading files..." : "Select a staged file..."} />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {stagedFiles.map(file => <SelectItem key={file.filename} value={file.filename}>{file.filename}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormDescription>Select a file that has been uploaded to the data file manager.</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            )}

            {(isParsing || (selectedFilename && csvHeaders.length > 0)) && (
            <Card className="bg-muted/50 p-4 space-y-4">
                {isParsing && <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Parsing file...</div>}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="dataType"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Data Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={csvHeaders.length === 0}>
                            <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select a type..." /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="water-level">Water Level</SelectItem>
                                <SelectItem value="precipitation">Precipitation</SelectItem>
                                <SelectItem value="sensor-suite">Sensor Suite (multiple readings)</SelectItem>
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
                        <FormDescription>The row number where the actual data begins.</FormDescription>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                <FormField
                    control={form.control}
                    name="datetimeColumn"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Date/Time Column</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={csvHeaders.length === 0}>
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

                {(dataType === "water-level" || dataType === "sensor-suite") && (
                    <FormField
                    control={form.control}
                    name="waterLevelColumn"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Water Level Column</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={csvHeaders.length === 0}>
                            <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select a column..." /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                {csvHeaders.map(header => <SelectItem key={header} value={header}>{header}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                )}
                {(dataType === "precipitation" || dataType === "sensor-suite") && (
                    <FormField
                    control={form.control}
                    name="precipitationColumn"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Precipitation Column</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={csvHeaders.length === 0}>
                            <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select a column..." /></SelectTrigger>
                            </FormControl>
                             <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                {csvHeaders.map(header => <SelectItem key={header} value={header}>{header}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                )}

                {dataType === "sensor-suite" && (
                    <>
                        <FormField
                        control={form.control}
                        name="sensorPressureColumn"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Sensor Pressure Column (Optional)</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} disabled={csvHeaders.length === 0}>
                                <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select a column..." /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    {csvHeaders.map(header => <SelectItem key={header} value={header}>{header}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            </FormItem>
                        )}
                        />
                        <FormField
                        control={form.control}
                        name="temperatureColumn"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Temperature Column (Optional)</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} disabled={csvHeaders.length === 0}>
                                <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select a column..." /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    {csvHeaders.map(header => <SelectItem key={header} value={header}>{header}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            </FormItem>
                        )}
                        />
                         <FormField
                        control={form.control}
                        name="barometerColumn"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Barometer Column (Optional)</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} disabled={csvHeaders.length === 0}>
                                <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select a column..." /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    {csvHeaders.map(header => <SelectItem key={header} value={header}>{header}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            </FormItem>
                        )}
                        />
                    </>
                )}
                </div>
                {csvSample.length > 0 && (
                <div className="space-y-2">
                    <Label>Preview of Data at Start Row ({startRow})</Label>
                    {currentPreviewRow ? (
                        <div className="p-2 border rounded-md max-h-40 overflow-y-auto text-xs space-y-1">
                        {csvHeaders.map((header, index) => {
                            const cellNode = document.createElement('div');
                            cellNode.textContent = currentPreviewRow[index] ?? '';
                            return (
                                <div key={header} className="grid grid-cols-2 gap-2">
                                    <span className="font-semibold text-muted-foreground truncate">{header}:</span>
                                    <span className="font-mono truncate" title={cellNode.textContent || ''}>{cellNode.textContent || <span className="text-muted-foreground/50">empty</span>}</span>
                                </div>
                            )
                        })}
                        </div>
                    ) : (
                        <div className="p-2 border rounded-md text-center text-xs text-muted-foreground">
                        Start row is outside the preview range.
                        </div>
                    )}
                </div>
                )}
            </Card>
            )}
        </div>
    )
}

function AssignDatafileDialog({ deployment }: { deployment: Deployment }) {
  const { toast } = useToast();
  const { assignDatafile, stagedFiles, loadingStagedFiles, getStagedFileContent } = useAssets();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isParsing, setIsParsing] = React.useState(false);
  const [csvHeaders, setCsvHeaders] = React.useState<string[]>([]);
  const [csvSample, setCsvSample] = React.useState<string[][]>([]);
  
  type AssignFormValues = z.infer<typeof assignDatafileSchema>;

  const form = useForm<AssignFormValues>({
    resolver: zodResolver(assignDatafileSchema),
    defaultValues: { startRow: 2, filename: undefined, datetimeColumn: undefined },
  });
  
  const resetDialogState = React.useCallback(() => {
    form.reset({ 
        startRow: 2, 
        filename: undefined, 
        datetimeColumn: undefined,
        dataType: undefined,
        waterLevelColumn: undefined,
        precipitationColumn: undefined,
        sensorPressureColumn: undefined,
        temperatureColumn: undefined,
        barometerColumn: undefined,
    });
    setCsvHeaders([]);
    setCsvSample([]);
    setIsSubmitting(false);
    setIsParsing(false);
  }, [form]);

  const handleSubmit = async (data: AssignFormValues) => {
    setIsSubmitting(true);
    
    const formData = new FormData();
    formData.append('deploymentId', deployment.id);
    formData.append('assetId', deployment.assetId);
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        formData.append(key, String(value));
      }
    });
    
    const result = await assignDatafile(formData);

    if (result?.message && result.message.startsWith('Error:')) {
      toast({ variant: "destructive", title: "Error Assigning File", description: result.message});
    } else {
      toast({ title: "File Assigned", description: `${data.filename} has been processed and assigned.` });
      setIsOpen(false);
    }
    setIsSubmitting(false);
  };
  
  const handleFileSelect = async (filename: string) => {
    if (!filename) {
      resetDialogState();
      return;
    }

    form.setValue("filename", filename);
    form.setValue("datetimeColumn", undefined);
    setCsvHeaders([]);
    setCsvSample([]);

    setIsParsing(true);
    toast({ title: "Parsing File...", description: "Reading headers and sample rows from the selected CSV file."});
    
    const fileContent = await getStagedFileContent(filename);
    
    if (!fileContent) {
        toast({ variant: "destructive", title: "Error", description: "Could not retrieve file content." });
        setIsParsing(false);
        return;
    }

    Papa.parse(fileContent, {
        preview: 10,
        skipEmptyLines: true,
        complete: (results) => {
            const data = results.data as string[][];
            if (data.length > 0) {
              const headers = data[0].filter(h => h);
              setCsvHeaders(headers);
              setCsvSample(data);
              
              const intelligentMap = getIntelligentMapping(headers);
              form.reset({
                  ...form.getValues(),
                  ...intelligentMap,
              });

              toast({ title: "File Parsed", description: "Please confirm the mapped columns." });
            } else {
               toast({ variant: "destructive", title: "Parsing Error", description: "Could not parse CSV. Check file format." });
            }
            setIsParsing(false);
        },
        error: (error) => {
            console.error("PapaParse error:", error);
            toast({ variant: "destructive", title: "Parsing Error", description: "Could not parse CSV file." });
            setIsParsing(false);
        }
    });
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      resetDialogState();
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><FileUp className="mr-2 h-4 w-4" /> Assign Datafile</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[725px]">
        <DialogHeader>
          <DialogTitle>Assign Datafile to {deployment.name}</DialogTitle>
          <DialogDescription>Select a staged file and map the columns for processing.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <DatafileFormContent 
                form={form}
                csvHeaders={csvHeaders}
                csvSample={csvSample}
                isParsing={isParsing}
                stagedFiles={stagedFiles}
                loadingStagedFiles={loadingStagedFiles}
                onFileSelect={handleFileSelect}
            />
            <DialogFooter className="mt-6">
              <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting || isParsing || !form.formState.isValid}>
                {isSubmitting ? "Processing..." : "Assign and Process"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ReassignDatafileDialog({ deployment, datafile, children }: { deployment: Deployment, datafile: DataFile, children: React.ReactNode }) {
    const { toast } = useToast();
    const { reassignDatafile, getSourceFileContent } = useAssets();
    const [isOpen, setIsOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isParsing, setIsParsing] = React.useState(false);
    const [csvHeaders, setCsvHeaders] = React.useState<string[]>([]);
    const [csvSample, setCsvSample] = React.useState<string[][]>([]);

    type ReassignFormValues = z.infer<typeof refinedDatafileSchema>;

    const form = useForm<ReassignFormValues>({
        resolver: zodResolver(refinedDatafileSchema),
        defaultValues: {
            ...datafile.columnMapping
        },
    });

    const resetDialogState = React.useCallback(() => {
        form.reset(datafile.columnMapping);
        setCsvHeaders([]);
        setCsvSample([]);
        setIsSubmitting(false);
        setIsParsing(false);
    }, [form, datafile.columnMapping]);

    const handleSubmit = async (data: ReassignFormValues) => {
        setIsSubmitting(true);
        const formData = new FormData();
        formData.append('deploymentId', deployment.id);
        formData.append('fileId', datafile.id);
        formData.append('filename', datafile.filename);

        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined) {
                formData.append(key, String(value));
            }
        });

        const result = await reassignDatafile(formData);

        if (result?.message && result.message.startsWith('Error:')) {
            toast({ variant: "destructive", title: "Error Re-assigning File", description: result.message });
        } else {
            toast({ title: "File Re-assigned", description: `${datafile.filename} has been re-processed.` });
            setIsOpen(false);
        }
        setIsSubmitting(false);
    };

    const loadAndParseFile = React.useCallback(async () => {
        if (!datafile.id) return;

        setIsParsing(true);
        const fileContent = await getSourceFileContent(`${datafile.id}.csv`);

        if (!fileContent) {
            toast({ variant: "destructive", title: "Error", description: "Could not retrieve source file content." });
            setIsParsing(false);
            setIsOpen(false);
            return;
        }

        Papa.parse(fileContent, {
            preview: 10,
            skipEmptyLines: true,
            complete: (results) => {
                const data = results.data as string[][];
                if (data.length > 0) {
                    const headers = data[0].filter(h => h);
                    setCsvHeaders(headers);
                    setCsvSample(data);

                    const intelligentMap = getIntelligentMapping(headers);
                    // We only apply the intelligent map if the original mapping is not already set
                    const currentValues = form.getValues();
                    const newValues = { ...currentValues };

                    for (const key in intelligentMap) {
                        const formKey = key as keyof typeof intelligentMap;
                        if (!currentValues[formKey] && intelligentMap[formKey]) {
                            newValues[formKey] = intelligentMap[formKey];
                        }
                    }
                    form.reset(newValues);
                }
                setIsParsing(false);
            },
            error: (error) => {
                console.error("PapaParse error:", error);
                setIsParsing(false);
            }
        });
    }, [datafile.id, getSourceFileContent, toast, form]);

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (open) {
            loadAndParseFile();
        } else {
            resetDialogState();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-[725px]">
                <DialogHeader>
                    <DialogTitle>Re-assign {datafile.filename}</DialogTitle>
                    <DialogDescription>
                        Edit the column mapping for this file. The data will be re-processed on save.
                    </DialogDescription>
                </DialogHeader>
                 <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)}>
                       <DatafileFormContent
                            form={form}
                            csvHeaders={csvHeaders}
                            csvSample={csvSample}
                            isParsing={isParsing}
                        />
                        <DialogFooter className="mt-6">
                            <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                            <Button type="submit" disabled={isSubmitting || isParsing || !form.formState.isValid}>
                                {isSubmitting ? "Re-processing..." : "Save and Re-process"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

function DatafileList({ deployment }: { deployment: Deployment }) {
    const { toast } = useToast();
    const { unassignDatafile, deleteDatafile } = useAssets();
    const [isActing, setIsActing] = React.useState<string | null>(null);

    if (!deployment.files || deployment.files.length === 0) {
        return (
        <div className="text-center text-sm text-muted-foreground border-dashed border-2 rounded-lg p-6">
            <p>No datafiles have been assigned to this deployment yet.</p>
        </div>
        );
    }
    
    const handleUnassign = async (fileId: string) => {
        setIsActing(`unassign-${fileId}`);
        const result = await unassignDatafile(deployment.id, fileId);
        if (result?.message && result.message.startsWith('Error:')) {
            toast({ variant: "destructive", title: "Error", description: result.message });
        } else {
            toast({ title: "Success", description: "File unassigned and returned to staging." });
        }
        setIsActing(null);
    }
    
    const handleDelete = async (fileId: string) => {
        setIsActing(`delete-${fileId}`);
        const result = await deleteDatafile(deployment.id, fileId);
         if (result?.message && result.message.startsWith('Error:')) {
            toast({ variant: "destructive", title: "Error", description: result.message });
        } else {
            toast({ title: "Success", description: "File permanently deleted." });
        }
        setIsActing(null);
    }


  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Filename</TableHead>
            <TableHead>Data Type</TableHead>
            <TableHead>Date Range</TableHead>
            <TableHead className="text-right">Rows</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deployment.files.map(file => (
            <TableRow key={file.id}>
              <TableCell className="font-medium">{file.filename}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                    {file.dataType === 'water-level' ? <Database className="h-4 w-4 text-muted-foreground" /> : <Droplets className="h-4 w-4 text-muted-foreground" />}
                    {file.dataType ? (
                      <span className="capitalize">{file.dataType.replace('-', ' ')}</span>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                </div>
              </TableCell>
              <TableCell>{new Date(file.startDate).toLocaleDateString()} - {new Date(file.endDate).toLocaleDateString()}</TableCell>
              <TableCell className="text-right">{file.rowCount}</TableCell>
              <TableCell className="text-right">
                    <ReassignDatafileDialog deployment={deployment} datafile={file}>
                        <Button variant="ghost" size="sm" disabled={!!isActing}>
                            <Edit className="mr-2 h-4 w-4" />
                            Re-assign
                        </Button>
                    </ReassignDatafileDialog>
                  
                  <Button variant="ghost" size="sm" onClick={() => handleUnassign(file.id)} disabled={!!isActing}>
                    {isActing === `unassign-${file.id}` ? <Loader2 className="h-4 w-4 animate-spin"/> : <Undo2 className="mr-2 h-4 w-4" />}
                    Unassign
                  </Button>
                  
                  <AlertDialog>
                      <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" disabled={!!isActing} className="text-destructive hover:text-destructive">
                            {isActing === `delete-${file.id}` ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4" />}
                            Delete
                          </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete the file <span className="font-bold">{file.filename}</span> and all its processed data. This action cannot be undone.
                              </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(file.id)} className="bg-destructive hover:bg-destructive/90">
                                  Delete Permanently
                              </AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DataFileManager({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const { stagedFiles, loadingStagedFiles, uploadStagedFile, deleteStagedFile } = useAssets();
  const [isUploading, setIsUploading] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(''); // Store filename being deleted
  const [isOpen, setIsOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    let successCount = 0;
    
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);
      const result = await uploadStagedFile(formData);
      if (result?.message && result.message.startsWith('Error:')) {
         toast({ title: `Error uploading ${file.name}`, description: result.message, variant: "destructive" });
      } else {
        successCount++;
      }
    }
    
    if (successCount > 0) {
       toast({ title: "Upload Complete", description: `${successCount} file(s) staged successfully.` });
    }

    setIsUploading(false);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };
  
  const handleDeleteFile = async (filename: string) => {
    setIsDeleting(filename);
    const result = await deleteStagedFile(filename);
    if (result?.message && result.message.startsWith('Error:')) {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    } else {
       toast({ title: "File Deleted", description: `'${filename}' has been removed from staging.` });
    }
    setIsDeleting('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Data File Manager</DialogTitle>
          <DialogDescription>
            Upload and manage data files that are staged for processing.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex items-center space-x-2">
            <Label htmlFor="file-upload" className="flex-1">
              <Button asChild variant="outline" className="w-full cursor-pointer">
                  <span><FileUp className="mr-2 h-4 w-4" /> Choose Files</span>
              </Button>
              <Input 
                id="file-upload" 
                ref={fileInputRef}
                type="file" 
                multiple 
                onChange={handleFileUpload}
                className="sr-only"
                disabled={isUploading}
                accept=".csv"
              />
            </Label>
             {isUploading && <Loader2 className="h-5 w-5 animate-spin" />}
          </div>
          
          <div className="mt-4 max-h-[300px] overflow-y-auto rounded-md border">
            {loadingStagedFiles ? (
                <div className="p-4 text-center text-muted-foreground">Loading staged files...</div>
            ) : stagedFiles.length === 0 ? (
              <p className="p-4 text-center text-muted-foreground">No files staged yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File Name</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stagedFiles.map((file) => (
                    <TableRow key={file.filename}>
                      <TableCell className="font-medium">
                        {file.filename}
                      </TableCell>
                      <TableCell>{(file.size / 1024).toFixed(2)} KB</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDeleteFile(file.filename)}
                          disabled={!!isDeleting}
                          title="Delete Staged File"
                        >
                          {isDeleting === file.filename ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function DeploymentList({ deployments, asset }: { deployments: Deployment[], asset: Asset }) {
  const { toast } = useToast();
  const { downloadLogs } = useAssets();
  
  const handleDownloadLogs = async (e: React.MouseEvent) => {
    e.stopPropagation();
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
    <Card className="col-span-1 lg:col-span-4 shadow-sm flex flex-col">
      <Accordion type="single" collapsible defaultValue="item-1">
        <AccordionItem value="item-1" className="border-b-0">
          <div className="p-6">
            <div className="flex justify-between items-start">
              <AccordionTrigger className="p-0 flex-1 hover:no-underline [&>svg]:ml-auto">
                  <div className="flex items-start gap-4 text-left">
                    <CalendarIcon className="h-6 w-6 shrink-0 text-muted-foreground" />
                    <div>
                      <CardTitle className="font-headline text-2xl">Deployments</CardTitle>
                      <CardDescription className="mt-1">
                        Manage sensor deployments and their associated datafiles.
                      </CardDescription>
                    </div>
                  </div>
              </AccordionTrigger>
            </div>
            <div className="flex justify-end items-center gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={handleDownloadLogs}>
                    <Download className="mr-2 h-4 w-4" />
                    Log
                </Button>
                <DataFileManager>
                    <Button variant="outline" size="sm">
                        <Files className="mr-2 h-4 w-4" />
                        Manage Files
                    </Button>
                </DataFileManager>
                <NewDeploymentDialog asset={asset} />
            </div>
          </div>
          <AccordionContent className="p-6 pt-0">
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
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}
