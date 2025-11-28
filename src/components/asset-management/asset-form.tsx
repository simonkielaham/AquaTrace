
"use client";

import * as React from "react";
import Image from "next/image";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, UseFormReturn, useWatch } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { PlusCircle, Trash2, ArrowUp, ArrowDown } from "lucide-react";

export const designElevationSchema = z.object({
  name: z.string().min(1, "Name is required."),
  customName: z.string().optional(),
  elevation: z.coerce.number().min(0, "Elevation is required"),
});

export const assetFormSchema = z.object({
  name: z.string().min(2, "Asset name must be at least 2 characters."),
  location: z.string().min(2, "Location is required."),
  latitude: z.coerce.number().min(-90, "Invalid latitude.").max(90, "Invalid latitude."),
  longitude: z.coerce.number().min(-180, "Invalid longitude.").max(180, "Invalid longitude."),
  permanentPoolElevation: z.coerce.number().min(0, "Permanent pool elevation is required."),
  designElevations: z.array(designElevationSchema),
  imageId: z.string().optional(),
});

export type AssetFormValues = z.infer<typeof assetFormSchema>;

export type AssetPayload = Omit<AssetFormValues, 'designElevations'> & {
  designElevations: { name: string; elevation: number }[];
  imageId: string;
};

export const elevationOptions = [
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

export function AssetForm({ form, onSubmit, isSubmitting, children }: AssetFormProps) {
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
