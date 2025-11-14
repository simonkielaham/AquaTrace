
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import Papa from "papaparse";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PlusCircle, Trash2, UploadCloud, TableIcon, ChevronDown, FilePenLine } from "lucide-react";
import { SidebarProvider, Sidebar } from "@/components/ui/sidebar";
import SidebarNav from "@/components/dashboard/sidebar-nav";
import PageHeader from "@/components/dashboard/page-header";
import { useToast } from "@/hooks/use-toast";
import { useAssets } from "@/context/asset-context";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { createAsset } from "@/app/actions";


const designElevationSchema = z.object({
  year: z.coerce.number().min(1, "Year is required"),
  elevation: z.coerce.number().min(0, "Elevation is required"),
});

const assetFormSchema = z.object({
  name: z.string().min(2, "Asset name must be at least 2 characters."),
  location: z.string().min(2, "Location is required."),
  permanentPoolElevation: z.coerce.number().min(0, "Permanent pool elevation is required."),
  designElevations: z.array(designElevationSchema).min(1, "At least one design elevation is required."),
  datetimeColumn: z.string().min(1, "Datetime column is required."),
  waterLevelColumn: z.string().min(1, "Water level column is required."),
  sensorElevation: z.coerce.number().min(0, "Sensor elevation is required."),
  startRow: z.coerce.number().min(1, "Start row must be at least 1."),
});

type AssetFormValues = z.infer<typeof assetFormSchema>;

const detectColumns = (headers: string[]) => {
  const datetimeKeywords = ["date", "time", "timestamp"];
  const waterLevelKeywords = ["water", "level", "elevation", "stage"];

  const datetimeColumn = headers.find(h => datetimeKeywords.some(k => h.toLowerCase().includes(k))) || "";
  const waterLevelColumn = headers.find(h => waterLevelKeywords.some(k => h.toLowerCase().includes(k))) || "";
  
  return { datetimeColumn, waterLevelColumn };
};

const statusVariantMap = {
  ok: "default",
  warning: "secondary",
  error: "destructive",
} as const;

function AssetListTable() {
  const { assets } = useAssets();
  const { toast } = useToast();

  const handleNotImplemented = () => {
    toast({
      title: "Feature not implemented",
      description: "This functionality is not yet available.",
    });
  };
  
  return (
     <Card>
      <CardHeader>
        <CardTitle className="font-headline">Existing Assets</CardTitle>
        <CardDescription>
          View, edit, or delete your existing stormwater management assets.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.map((asset) => (
              <TableRow key={asset.id}>
                <TableCell className="font-medium">{asset.name}</TableCell>
                <TableCell>{asset.location}</TableCell>
                <TableCell>
                   <Badge variant={statusVariantMap[asset.status]} className="capitalize">
                    {asset.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={handleNotImplemented}>
                    <FilePenLine className="h-4 w-4" />
                    <span className="sr-only">Edit</span>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleNotImplemented}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                     <span className="sr-only">Delete</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}


export default function AssetManagementPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { assets, setSelectedAssetId } = useAssets();

  const [csvHeaders, setCsvHeaders] = React.useState<string[]>([]);
  const [file, setFile] = React.useState<File | null>(null);
  const [fileContent, setFileContent] = React.useState<string | null>(null);

  const form = useForm<AssetFormValues>({
    resolver: zodResolver(assetFormSchema),
    defaultValues: {
      name: "",
      location: "",
      permanentPoolElevation: 0,
      designElevations: [{ year: 2, elevation: 0 }],
      sensorElevation: 0,
      startRow: 2,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "designElevations",
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
          preview: 1, // Only parse the first row for headers
          complete: (results) => {
            const headers = results.meta.fields || [];
            setCsvHeaders(headers);
            const { datetimeColumn, waterLevelColumn } = detectColumns(headers);
            form.setValue("datetimeColumn", datetimeColumn);
            form.setValue("waterLevelColumn", waterLevelColumn);
            form.setValue("startRow", 2);
          },
        });
      };
      reader.readAsText(selectedFile);
    }
  };
  
  const formRef = React.useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formRef.current) return;

    // Manually trigger validation
    const isValid = await form.trigger();
    if (!isValid) {
        toast({
            variant: "destructive",
            title: "Validation Error",
            description: "Please check the form for errors.",
        });
        return;
    }

    const formData = new FormData(formRef.current);
    if (file) {
      formData.append('csvFile', file);
    }
    if (fileContent) {
        formData.append('csvContent', fileContent);
    }

    toast({
        title: 'Creating Asset...',
        description: 'Please wait while we save your data.',
    });

    try {
      // The server action will handle redirection on success
      const result = await createAsset(null, formData);

      if (result?.message) {
          toast({
              variant: "destructive",
              title: "Error Creating Asset",
              description: result.message,
          });
      }
    } catch (error) {
        toast({
            variant: "destructive",
            title: "An Unexpected Error Occurred",
            description: "Could not create the asset. Please try again.",
        });
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar>
          <SidebarNav
            assets={assets}
            selectedAssetId={""} // No asset is "selected" on this page
            onSelectAsset={(id) => {
              setSelectedAssetId(id);
              router.push('/');
            }}
          />
        </Sidebar>
        <div className="flex flex-1 flex-col">
          <PageHeader />
          <main className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="space-y-6">
              <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
                <AccordionItem value="item-1">
                  <Card>
                    <AccordionTrigger className="w-full p-6 [&[data-state=open]>svg]:rotate-180">
                       <div className="flex w-full justify-between items-center">
                          <div>
                            <CardTitle className="font-headline text-left">Add New Asset</CardTitle>
                            <CardDescription className="text-left mt-1">
                              Fill in the details below to create a new stormwater management asset.
                            </CardDescription>
                          </div>
                          <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-200" />
                       </div>
                    </AccordionTrigger>
                    <AccordionContent>
                       <CardContent>
                        <Form {...form}>
                          <form ref={formRef} onSubmit={handleSubmit} className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              <div className="space-y-8">
                                <FormField
                                  control={form.control}
                                  name="name"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Asset Name</FormLabel>
                                      <FormControl>
                                        <Input placeholder="e.g., Northwood Pond" {...field} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name="location"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Location</FormLabel>
                                      <FormControl>
                                        <Input placeholder="e.g., Springfield, ON" {...field} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name="permanentPoolElevation"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Permanent Pool Elevation (meters)</FormLabel>
                                      <FormControl>
                                        <Input type="number" step="0.01" {...field} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                              <div className="space-y-8">
                                <div>
                                  <FormLabel>Design Elevations</FormLabel>
                                  <FormDescription className="mb-4">
                                    Specify design storm year and corresponding elevation.
                                  </FormDescription>
                                  <div className="space-y-4">
                                    {fields.map((field, index) => (
                                      <div key={field.id} className="flex items-end gap-4">
                                        <FormField
                                          control={form.control}
                                          name={`designElevations.${index}.year`}
                                          render={({ field }) => (
                                            <FormItem className="flex-1">
                                              <FormLabel className="text-xs">Year</FormLabel>
                                              <FormControl>
                                                <Input type="number" placeholder="e.g., 10" {...field} />
                                              </FormControl>
                                              <FormMessage />
                                            </FormItem>
                                          )}
                                        />
                                        <FormField
                                          control={form.control}
                                          name={`designElevations.${index}.elevation`}
                                          render={({ field }) => (
                                            <FormItem className="flex-1">
                                              <FormLabel className="text-xs">Elevation (m)</FormLabel>
                                              <FormControl>
                                                <Input type="number" step="0.01" placeholder="e.g., 12.0" {...field} />
                                              </FormControl>
                                              <FormMessage />
                                            </FormItem>
                                          )}
                                        />
                                        <Button
                                          type="button"
                                          variant="destructive"
                                          size="icon"
                                          onClick={() => remove(index)}
                                          disabled={fields.length <= 1}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="mt-4"
                                    onClick={() => append({ year: 0, elevation: 0 })}
                                  >
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Add Elevation
                                  </Button>
                                </div>
                              </div>
                            </div>
                            
                            <Separator />
                            
                            <div>
                              <FormLabel>Water Level Datafile</FormLabel>
                              <FormDescription className="mb-4">
                                Upload a CSV file containing time series data. Map the columns and specify the data start row.
                              </FormDescription>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="flex items-center justify-center w-full">
                                  <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                      <UploadCloud className="w-8 h-8 mb-4 text-muted-foreground" />
                                      <p className="mb-2 text-sm text-muted-foreground">
                                        {file ? (
                                          <span className="font-semibold">{file.name}</span>
                                        ) : (
                                          <>
                                            <span className="font-semibold">Click to upload</span> or drag and drop
                                          </>
                                        )}
                                      </p>
                                      <p className="text-xs text-muted-foreground">CSV (MAX. 5MB)</p>
                                    </div>
                                    <Input id="dropzone-file" type="file" className="hidden" onChange={handleFileChange} accept=".csv" />
                                  </label>
                                </div>
                                {csvHeaders.length > 0 && (
                                  <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-sm font-medium">
                                        <TableIcon className="h-5 w-5" />
                                        <span>Column Mapping & Settings</span>
                                    </div>
                                    <FormField
                                      control={form.control}
                                      name="datetimeColumn"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Datetime Column</FormLabel>
                                          <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                              <SelectTrigger>
                                                <SelectValue placeholder="Select a column" />
                                              </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                              {csvHeaders.map(header => (
                                                <SelectItem key={header} value={header}>{header}</SelectItem>
                                              ))}
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
                                          <Select onValue-change={field.onChange} value={field.value}>
                                            <FormControl>
                                              <SelectTrigger>
                                                <SelectValue placeholder="Select a column" />
                                              </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                              {csvHeaders.map(header => (
                                                <SelectItem key={header} value={header}>{header}</SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                     <FormField
                                        control={form.control}
                                        name="sensorElevation"
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>Sensor Elevation (meters)</FormLabel>
                                            <FormControl>
                                              <Input type="number" step="0.01" {...field} />
                                            </FormControl>
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
                                            <FormControl>
                                              <Input type="number" min="1" {...field} />
                                            </FormControl>
                                            <FormDescription>The first row containing data (not headers).</FormDescription>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                  </div>
                                )}
                              </div>
                            </div>

                            <Button type="submit" disabled={!file}>Create Asset</Button>
                          </form>
                        </Form>
                       </CardContent>
                     </AccordionContent>
                  </Card>
                </AccordionItem>
              </Accordion>
             
              <AssetListTable />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
