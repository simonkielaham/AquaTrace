
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, UseFormReturn, useWatch } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import Image from "next/image";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PlusCircle, Trash2, FilePenLine, ChevronDown, ArrowUp, ArrowDown } from "lucide-react";
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
  name: z.string().min(1, "Name is required."),
  customName: z.string().optional(),
  elevation: z.coerce.number().min(0, "Elevation is required"),
});

const assetFormSchema = z.object({
  name: z.string().min(2, "Asset name must be at least 2 characters."),
  location: z.string().min(2, "Location is required."),
  latitude: z.coerce.number().min(-90, "Invalid latitude.").max(90, "Invalid latitude."),
  longitude: z.coerce.number().min(-180, "Invalid longitude.").max(180, "Invalid longitude."),
  permanentPoolElevation: z.coerce.number().min(0, "Permanent pool elevation is required."),
  designElevations: z.array(designElevationSchema),
  imageId: z.string().optional(),
});

type AssetFormValues = z.infer<typeof assetFormSchema>;

// This is the type that will be sent to the server actions
type AssetPayload = Omit<AssetFormValues, 'designElevations'> & {
  designElevations: { name: string; elevation: number }[];
  imageId: string;
};


const statusVariantMap = {
  ok: "default",
  warning: "secondary",
  error: "destructive",
} as const;

const elevationOptions = [
    "2 year",
    "5 year",
    "10 year",
    "25 year",
    "100 year",
    "Emergency Spillway",
    "Surveyed Outlet",
    "Pond Bottom",
    "Custom"
];

function DesignElevationRow({ control, index, remove, swap }: { control: any, index: number, remove: (index: number) => void, swap: (index1: number, index2: number) => void }) {
    const watchName = useWatch({
        control,
        name: `designElevations.${index}.name`
    });
    
    const { fields } = useFieldArray({ control, name: "designElevations" });

    const isCustom = watchName === 'Custom';

    return (
      <div className="flex items-start gap-2 rounded-md border p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
          <div className="space-y-2">
            <FormField
              control={control}
              name={`designElevations.${index}.name`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {elevationOptions.map(option => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {isCustom && (
              <FormField
                control={control}
                name={`designElevations.${index}.customName`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="sr-only">Custom Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter custom name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
          <FormField
            control={control}
            name={`designElevations.${index}.elevation`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Elevation (m)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="e.g., 12.0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex flex-col items-center gap-1 pt-1">
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => swap(index, index - 1)} disabled={index === 0}>
              <ArrowUp className="h-4 w-4"/>
              <span className="sr-only">Move Up</span>
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => swap(index, index + 1)} disabled={index === fields.length - 1}>
              <ArrowDown className="h-4 w-4"/>
              <span className="sr-only">Move Down</span>
          </Button>
        </div>
        <div className="pt-7">
          <Button
            type="button"
            variant="destructive"
            size="icon"
            onClick={() => remove(index)}
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete</span>
          </Button>
        </div>
      </div>
    );
}

interface AssetFormProps {
  form: UseFormReturn<AssetFormValues>;
  onSubmit: (data: AssetFormValues) => void;
  isSubmitting: boolean;
  children: React.ReactNode; 
}

function AssetForm({ form, onSubmit, isSubmitting, children }: AssetFormProps) {
  const { fields, append, remove, swap } = useFieldArray({
    control: form.control,
    name: "designElevations",
  });
  
  const [imagePreview, setImagePreview] = React.useState<string | null>(form.getValues('imageId') || null);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        form.setValue('imageId', base64String);
        setImagePreview(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  React.useEffect(() => {
      const initialImageId = form.getValues('imageId');
      if (initialImageId) {
        setImagePreview(initialImageId);
      }
  }, [form]);


  return (
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
                    <Input placeholder="e.g, Springfield, ON" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="latitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Latitude</FormLabel>
                      <FormControl>
                        <Input type="number" step="any" placeholder="e.g., 43.6532" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="longitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Longitude</FormLabel>
                      <FormControl>
                        <Input type="number" step="any" placeholder="e.g., -79.3832" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
             <div className="space-y-4">
                <FormItem>
                    <FormLabel>Asset Image</FormLabel>
                    <FormControl>
                        <Input type="file" accept="image/*" onChange={handleImageChange} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
              
              {imagePreview && (
                <div className="relative h-40 w-full rounded-md overflow-hidden border">
                   <Image 
                     src={imagePreview} 
                     alt="Asset preview" 
                     fill
                     className="object-cover"
                     unoptimized
                   />
                </div>
              )}
            </div>

          </div>
          <div className="space-y-4">
            <div>
              <FormLabel>Optional Design Elevations</FormLabel>
              <FormDescription className="mb-4">
                Add and reorder any other relevant design elevations.
              </FormDescription>
              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2">
                {fields.map((field, index) => (
                  <DesignElevationRow
                    key={field.id}
                    control={form.control}
                    index={index}
                    remove={remove}
                    swap={swap}
                  />
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => append({ name: "", elevation: 0, customName: "" })}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Elevation
              </Button>
            </div>
          </div>
        </div>
        {children}
      </form>
    </Form>
  );
}


export function EditAssetDialog({ asset, children }: { asset: Asset, children: React.ReactNode }) {
  const { toast } = useToast();
  const { updateAsset } = useAssets();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);

  const form = useForm<AssetFormValues>({
    resolver: zodResolver(assetFormSchema),
    defaultValues: {
      name: asset.name,
      location: asset.location,
      latitude: asset.latitude,
      longitude: asset.longitude,
      permanentPoolElevation: asset.permanentPoolElevation,
      designElevations: asset.designElevations.map(de => {
        const isStandard = elevationOptions.includes(de.name);
        return {
          name: isStandard ? de.name : "Custom",
          customName: isStandard ? "" : de.name,
          elevation: de.elevation
        }
      }),
      imageId: asset.imageId,
    },
  });

  React.useEffect(() => {
    if (asset) {
      form.reset({
        name: asset.name,
        location: asset.location,
        latitude: asset.latitude,
        longitude: asset.longitude,
        permanentPoolElevation: asset.permanentPoolElevation,
        designElevations: asset.designElevations.map(de => {
          const isStandard = elevationOptions.includes(de.name);
          return {
            name: isStandard ? de.name : "Custom",
            customName: isStandard ? "" : de.name,
            elevation: de.elevation,
          };
        }),
        imageId: asset.imageId,
      });
    }
  }, [asset, form]);

  const handleEditSubmit = async (data: AssetFormValues) => {
    setIsSubmitting(true);
    toast({
      title: "Updating Asset...",
      description: "Please wait while we save your changes.",
    });

    const payload: AssetPayload = {
      ...data,
      imageId: data.imageId || '',
      designElevations: data.designElevations.map(de => ({
        name: de.name === 'Custom' ? de.customName || 'Custom' : de.name,
        elevation: de.elevation,
      })).filter(de => de.name), // Filter out empty ones
    };

    const result = await updateAsset(asset.id, payload);
    
    if (result?.message && result.message.startsWith('Error:')) {
      toast({
        variant: "destructive",
        title: "Error Updating Asset",
        description: <pre className="mt-2 w-full rounded-md bg-slate-950 p-4"><code className="text-white whitespace-pre-wrap break-all">{result.message}</code></pre>
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
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[825px]">
        <DialogHeader>
          <DialogTitle>Edit Asset: {asset.name}</DialogTitle>
          <DialogDescription>
            Update the details for this asset. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <AssetForm form={form} onSubmit={handleEditSubmit} isSubmitting={isSubmitting}>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </AssetForm>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteAssetDialog({ asset, children, onDeleted }: { asset: Asset, children: React.ReactNode, onDeleted: () => void }) {
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
    if (result?.message && result.message.startsWith('Error:')) {
      toast({
        variant: "destructive",
        title: "Error Deleting Asset",
        description: <pre className="mt-2 w-full rounded-md bg-slate-950 p-4"><code className="text-white whitespace-pre-wrap break-all">{result.message}</code></pre>
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
        {children}
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
          <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
            {isDeleting ? "Deleting..." : "Delete Permanently"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}


function AssetListTable() {
  const { assets } = useAssets();
  const [_, startTransition] = React.useTransition();
  const router = useRouter();

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
                  <EditAssetDialog asset={asset}>
                    <Button variant="ghost" size="icon" title="Edit Asset">
                      <FilePenLine className="h-4 w-4" />
                      <span className="sr-only">Edit</span>
                    </Button>
                  </EditAssetDialog>
                  <DeleteAssetDialog asset={asset} onDeleted={() => {
                     startTransition(() => {
                        router.refresh(); 
                     })
                  }}>
                    <Button variant="ghost" size="icon" title="Delete Asset">
                      <Trash2 className="h-4 w-4 text-destructive" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </DeleteAssetDialog>
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
  const [isAccordionOpen, setIsAccordionOpen] = React.useState(true);

  const form = useForm<AssetFormValues>({
    resolver: zodResolver(assetFormSchema),
    defaultValues: {
      name: "",
      location: "",
      latitude: 0,
      longitude: 0,
      permanentPoolElevation: 0,
      designElevations: [],
      imageId: ""
    },
  });
  
  const handleSubmit = async (data: AssetFormValues) => {
    setIsSubmitting(true);
    toast({
        title: 'Creating Asset...',
        description: 'Please wait while we create the asset.',
    });
    
    const payload: AssetPayload = {
      ...data,
      imageId: data.imageId || '',
      designElevations: data.designElevations.map(de => ({
        name: de.name === 'Custom' ? de.customName || 'Custom' : de.name,
        elevation: de.elevation,
      })).filter(de => de.name),
    };

    const result = await createAsset(payload);

    if (result?.message && result.message.startsWith('Error:')) {
        toast({
            variant: "destructive",
            title: "Error Creating Asset",
            description: <pre className="mt-2 w-full rounded-md bg-slate-950 p-4"><code className="text-white whitespace-pre-wrap break-all">{result.message}</code></pre>
        });
    } else {
        toast({
          title: 'Asset Created!',
          description: `${data.name} has been successfully created.`,
      });
      form.reset();
      setIsAccordionOpen(false);
      if (result.newAsset) {
        setSelectedAssetId(result.newAsset.id);
      }
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
              <Accordion type="single" collapsible className="w-full" value={isAccordionOpen ? "item-1" : ""} onValueChange={(value) => setIsAccordionOpen(value === "item-1")}>
                <AccordionItem value="item-1">
                  <Card>
                    <AccordionTrigger className="w-full p-6">
                       <div className="flex items-center gap-4 text-left">
                          <PlusCircle className="h-6 w-6 text-muted-foreground" />
                          <div>
                            <span className="font-headline text-lg">Add New Asset</span>
                            <p className="text-sm font-normal text-muted-foreground mt-1">
                              Fill in the details below to create a new stormwater management asset.
                            </p>
                          </div>
                       </div>
                       <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-200" />
                    </AccordionTrigger>
                    <AccordionContent>
                       <CardContent>
                        <AssetForm form={form} onSubmit={handleSubmit} isSubmitting={isSubmitting}>
                          <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "Creating..." : "Create Asset"}
                          </Button>
                        </AssetForm>
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

    