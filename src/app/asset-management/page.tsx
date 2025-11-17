
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { PlusCircle, Trash2, FilePenLine, ChevronDown } from "lucide-react";
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
import { Asset } from "@/lib/placeholder-data";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";


const designElevationSchema = z.object({
  year: z.coerce.number().min(1, "Year is required"),
  elevation: z.coerce.number().min(0, "Elevation is required"),
});

const assetFormSchema = z.object({
  name: z.string().min(2, "Asset name must be at least 2 characters."),
  location: z.string().min(2, "Location is required."),
  permanentPoolElevation: z.coerce.number().min(0, "Permanent pool elevation is required."),
  designElevations: z.array(designElevationSchema).min(1, "At least one design elevation is required."),
});

type AssetFormValues = z.infer<typeof assetFormSchema>;

const editAssetFormSchema = z.object({
  name: z.string().min(2, "Asset name must be at least 2 characters."),
  location: z.string().min(2, "Location is required."),
  permanentPoolElevation: z.coerce.number().min(0, "Permanent pool elevation is required."),
  designElevations: z.array(designElevationSchema).min(1, "At least one design elevation is required."),
});

type EditAssetFormValues = z.infer<typeof editAssetFormSchema>;

const statusVariantMap = {
  ok: "default",
  warning: "secondary",
  error: "destructive",
} as const;


function EditAssetDialog({ asset }: { asset: Asset }) {
  const { toast } = useToast();
  const { updateAsset } = useAssets();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);

  const form = useForm<EditAssetFormValues>({
    resolver: zodResolver(editAssetFormSchema),
    defaultValues: {
      name: asset.name,
      location: asset.location,
      permanentPoolElevation: asset.permanentPoolElevation,
      designElevations: asset.designElevations,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "designElevations",
  });

  const handleEditSubmit = async (data: EditAssetFormValues) => {
    setIsSubmitting(true);
    toast({
      title: "Updating Asset...",
      description: "Please wait while we save your changes.",
    });

    const result = await updateAsset(asset.id, data);
    
    if (result?.message && result.message.startsWith('Error:')) {
      toast({
        variant: "destructive",
        title: "Error Updating Asset",
        description: <pre className="mt-2 w-full max-w-[550px] whitespace-pre-wrap break-all rounded-md bg-slate-950 p-4"><code className="text-white">{result.message}</code></pre>
      });
    } else {
      toast({
        title: "Asset Updated!",
        description: `${data.name} has been successfully updated.`,
      });
      setIsOpen(false); 
    }
    
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <FilePenLine className="h-4 w-4" />
          <span className="sr-only">Edit</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>Edit Asset: {asset.name}</DialogTitle>
          <DialogDescription>
            Update the details for this asset. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleEditSubmit)} className="space-y-8">
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
                        <Input placeholder="e.g, Springfield, ON" {...field} />
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
                  <div className="space-y-4 max-h-[200px] overflow-y-auto pr-2">
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
             <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteAssetDialog({ asset, onDeleted }: { asset: Asset, onDeleted: () => void }) {
  const { toast } = useToast();
  const { deleteAsset } = useAssets();
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    toast({
      title: `Deleting ${asset.name}...`,
      description: "Please wait.",
    });

    const result = await deleteAsset(asset.id);
    if (result.message.startsWith('Error:')) {
      toast({
        variant: "destructive",
        title: "Error Deleting Asset",
        description: <pre className="mt-2 w-full max-w-[550px] whitespace-pre-wrap break-all rounded-md bg-slate-950 p-4"><code className="text-white">{result.message}</code></pre>
      });
    } else {
      toast({
        title: "Asset Deleted",
        description: `${asset.name} and all its data have been removed.`,
      });
      onDeleted(); // Callback to potentially close dialog or refresh
    }
    
    setIsDeleting(false);
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Trash2 className="h-4 w-4 text-destructive" />
          <span className="sr-only">Delete</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the asset{" "}
            <span className="font-semibold">{asset.name}</span> and all of its
            associated deployment and performance data.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}


function AssetListTable() {
  const { assets } = useAssets();
  const [_, startTransition] = React.useTransition();

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
                  <EditAssetDialog asset={asset} />
                  <DeleteAssetDialog asset={asset} onDeleted={() => startTransition(() => {})} />
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
  const { assets, setSelectedAssetId, createAsset } = useAssets();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

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
  
  const handleSubmit = async (data: AssetFormValues) => {
    setIsSubmitting(true);
    toast({
        title: 'Creating Asset...',
        description: 'Please wait while we create the asset.',
    });

    const result = await createAsset(data);

    if (result?.message && result.message.startsWith('Error:')) {
        toast({
            variant: "destructive",
            title: "Error Creating Asset",
            description: <pre className="mt-2 w-full max-w-[550px] whitespace-pre-wrap break-all rounded-md bg-slate-950 p-4"><code className="text-white">{result.message}</code></pre>
        });
    } else {
        toast({
          title: 'Asset Created!',
          description: `${data.name} has been successfully created.`,
      });
      form.reset();
      router.push('/');
    }
    
    setIsSubmitting(false);
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
                          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
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
                                        <Input placeholder="e.g, Springfield, ON" {...field} />
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
                            <Button type="submit" disabled={isSubmitting}>
                               {isSubmitting ? "Creating..." : "Create Asset"}
                            </Button>
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
