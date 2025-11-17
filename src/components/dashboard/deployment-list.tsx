
"use client";

import type { Deployment, DataFile, Asset } from "@/lib/placeholder-data";
import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
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
import { FileText, PlusCircle, UploadCloud, Save, ChevronDown } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

// Schemas for forms
const editDeploymentSchema = z.object({
  sensorId: z.string().min(1, "Sensor ID is required."),
  sensorElevation: z.coerce.number(),
});

type EditDeploymentValues = z.infer<typeof editDeploymentSchema>;

const addDatafileSchema = z.object({
  datetimeColumn: z.string().min(1, "Datetime column is required."),
  waterLevelColumn: z.string().min(1, "Water level column is required."),
  startRow: z.coerce.number().min(1, "Start row must be at least 1."),
});

type AddDatafileValues = z.infer<typeof addDatafileSchema>;

const detectColumns = (headers: string[]) => {
  const datetimeKeywords = ["date", "time", "timestamp"];
  const waterLevelKeywords = ["water", "level", "elevation", "stage"];

  const datetimeColumn = headers.find(h => datetimeKeywords.some(k => h.toLowerCase().includes(k))) || "";
  const waterLevelColumn = headers.find(h => waterLevelKeywords.some(k => h.toLowerCase().includes(k))) || "";
  
  return { datetimeColumn, waterLevelColumn };
};


function AddDatafileDialog({ deployment, asset }: { deployment: Deployment, asset: Asset }) {
  const { toast } = useToast();
  const { addDatafile } = useAssets();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [csvHeaders, setCsvHeaders] = React.useState<string[]>([]);
  const [file, setFile] = React.useState<File | null>(null);
  const [fileContent, setFileContent] = React.useState<string | null>(null);

  const form = useForm<AddDatafileValues>({
    resolver: zodResolver(addDatafileSchema),
    defaultValues: {
      startRow: 2
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setFileContent(text);
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          preview: 1,
          complete: (results) => {
            const headers = results.meta.fields || [];
            setCsvHeaders(headers);
            const { datetimeColumn, waterLevelColumn } = detectColumns(headers);
            form.setValue("datetimeColumn", datetimeColumn);
            form.setValue("waterLevelColumn", waterLevelColumn);
          },
        });
      };
      reader.readAsText(selectedFile);
    }
  };

  const handleSubmit = async (data: AddDatafileValues) => {
    if (!file || !fileContent) {
      toast({ variant: "destructive", title: "File Missing" });
      return;
    }
    setIsSubmitting(true);
    
    const formData = new FormData();
    formData.append('csvFile', file);
    formData.append('csvContent', fileContent);
    
    try {
      const result = await addDatafile(deployment.id, data, formData);
      if (result?.errors) {
        toast({ variant: "destructive", title: "Error", description: result.message });
      } else {
        toast({ title: "Success", description: "New datafile added." });
        setIsOpen(false);
        form.reset();
        setFile(null);
        setFileContent(null);
        setCsvHeaders([]);
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Could not add datafile." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Datafile
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>Add Datafile to Sensor: {deployment.sensorId}</DialogTitle>
          <DialogDescription>
            Upload a new CSV datafile. The data will be appended to the asset's performance history.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="flex items-center justify-center w-full">
              <label htmlFor={`dropzone-file-${deployment.id}`} className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <UploadCloud className="w-8 h-8 mb-4 text-muted-foreground" />
                  <p className="mb-2 text-sm text-muted-foreground">
                    {file ? <span className="font-semibold">{file.name}</span> : <><span className="font-semibold">Click to upload</span> or drag and drop</>}
                  </p>
                  <p className="text-xs text-muted-foreground">CSV (MAX. 5MB)</p>
                </div>
                <Input id={`dropzone-file-${deployment.id}`} type="file" className="hidden" onChange={handleFileChange} accept=".csv" />
              </label>
            </div>
            {csvHeaders.length > 0 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="datetimeColumn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Datetime Column</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select a column" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>{csvHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
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
                            <SelectTrigger><SelectValue placeholder="Select a column" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>{csvHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
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
                      <FormControl><Input type="number" min="1" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
             <DialogFooter>
              <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting || !file}>
                {isSubmitting ? "Saving..." : "Save Datafile"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}


function EditDeploymentForm({ deployment }: { deployment: Deployment }) {
  const { toast } = useToast();
  const { updateDeployment } = useAssets();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<EditDeploymentValues>({
    resolver: zodResolver(editDeploymentSchema),
    defaultValues: {
      sensorId: deployment.sensorId,
      sensorElevation: deployment.sensorElevation,
    },
  });

  const onSubmit = async (data: EditDeploymentValues) => {
    setIsSubmitting(true);
    try {
      const result = await updateDeployment(deployment.id, data);
      if (result?.errors) {
        toast({ variant: "destructive", title: "Error", description: result.message });
      } else {
        toast({ title: "Success", description: "Deployment updated." });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Could not update deployment." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
  const [formattedDeployments, setFormattedDeployments] = React.useState(deployments);

  React.useEffect(() => {
    setFormattedDeployments(
      deployments.map(d => ({
        ...d,
        files: (d.files || []).map(f => ({
          ...f,
          startDate: new Date(f.startDate).toLocaleDateString(),
          endDate: f.endDate ? new Date(f.endDate).toLocaleDateString() : "Present",
        }))
      }))
    );
  }, [deployments]);

  const handleNotImplemented = () => {
    toast({
      title: "Feature not implemented",
      description: "This functionality is not yet available.",
    });
  };

  return (
    <Card className="col-span-1 lg:col-span-2 shadow-sm flex flex-col">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="grid gap-2">
            <CardTitle className="font-headline">Deployments</CardTitle>
            <CardDescription>
              Manage sensor deployments and associated datafiles for this asset.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleNotImplemented}>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Deployment
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <ScrollArea className="h-[280px]">
          <Accordion type="multiple" className="w-full">
            {formattedDeployments.map((deployment) => (
              <AccordionItem value={deployment.id} key={deployment.id}>
                <AccordionTrigger>
                   <div className="flex items-center gap-2">
                    <span className="font-semibold">Sensor:</span> 
                    <span className="font-mono text-primary">{deployment.sensorId}</span>
                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                   </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-6 pl-2">
                    <EditDeploymentForm deployment={deployment} />
                    <Separator />
                    <div className="space-y-2">
                       <div className="flex justify-between items-center">
                         <h4 className="font-semibold">Datafiles</h4>
                         <AddDatafileDialog deployment={deployment} asset={asset} />
                       </div>
                       <Table>
                          <TableHeader>
                              <TableRow>
                                <TableHead>File Name</TableHead>
                                <TableHead>Data Period</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {(deployment.files || []).map((file) => (
                              <TableRow key={file.id}>
                                  <TableCell className="flex items-center gap-2 text-muted-foreground">
                                      <FileText className="h-4 w-4" />
                                      <span className="font-mono text-xs">{file.fileName}</span>
                                  </TableCell>
                                  <TableCell>
                                    {file.startDate} - {file.endDate}
                                  </TableCell>
                              </TableRow>
                              ))}
                              {(!deployment.files || deployment.files.length === 0) && (
                                <TableRow>
                                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                                    No datafiles for this deployment yet.
                                  </TableCell>
                                </TableRow>
                              )}
                          </TableBody>
                      </Table>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

    