
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";

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
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PlusCircle, Trash2 } from "lucide-react";
import { SidebarProvider, Sidebar } from "@/components/ui/sidebar";
import SidebarNav from "@/components/dashboard/sidebar-nav";
import PageHeader from "@/components/dashboard/page-header";
import { assets } from "@/lib/placeholder-data";
import { useToast } from "@/hooks/use-toast";

const designElevationSchema = z.object({
  year: z.coerce.number().min(1, "Year is required"),
  elevation: z.coerce.number().min(0, "Elevation is required"),
});

const assetFormSchema = z.object({
  name: z.string().min(2, "Asset name must be at least 2 characters."),
  location: z.string().min(2, "Location is required."),
  permanentPoolElevation: z.coerce.number().min(0, "Permanent pool elevation is required."),
  designElevations: z.array(designElevationSchema).min(1, "At least one design elevation is required."),
  datafile: z.any().refine((file) => file?.length == 1, "Datafile is required."),
});

type AssetFormValues = z.infer<typeof assetFormSchema>;

export default function AssetManagementPage() {
  const { toast } = useToast();
  const [selectedAssetId, setSelectedAssetId] = React.useState("asset-management");

  const form = useForm<AssetFormValues>({
    resolver: zodResolver(assetFormSchema),
    defaultValues: {
      name: "",
      location: "",
      permanentPoolElevation: 0,
      designElevations: [{ year: 2, elevation: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "designElevations",
  });
  
  const fileRef = form.register("datafile");

  function onSubmit(data: AssetFormValues) {
    console.log(data);
    toast({
      title: "Asset Submitted",
      description: (
        <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
          <code className="text-white">{JSON.stringify(data, null, 2)}</code>
        </pre>
      ),
    });
    form.reset();
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar>
          <SidebarNav
            assets={assets}
            selectedAssetId={selectedAssetId}
            onSelectAsset={setSelectedAssetId}
          />
        </Sidebar>
        <div className="flex flex-1 flex-col">
          <PageHeader />
          <main className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-headline">Add New Asset</CardTitle>
                <CardDescription>
                  Fill in the details below to create a new stormwater management asset.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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

                    <FormField
                      control={form.control}
                      name="datafile"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Water Level Datafile</FormLabel>
                          <FormControl>
                            <Input type="file" accept=".csv" {...fileRef} />
                          </FormControl>
                          <FormDescription>
                            Upload a CSV file containing time series data for water level and precipitation.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit">Create Asset</Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
