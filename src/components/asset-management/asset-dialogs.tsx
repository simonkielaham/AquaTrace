
"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
  DialogFooter
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
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAssets } from "@/context/asset-context";
import { Asset } from "@/lib/placeholder-data";
import { AssetForm, type AssetFormValues, type AssetPayload, elevationOptions } from "./asset-form";

export function EditAssetDialog({ asset, children }: { asset: Asset, children: React.ReactNode }) {
  const { toast } = useToast();
  const { updateAsset, useAssetForm } = useAssets();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);

  const form = useAssetForm();

  React.useEffect(() => {
    if (isOpen && asset) {
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
  }, [isOpen, asset, form]);

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
      })).filter(de => de.name),
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
      onDeleted(); 
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
