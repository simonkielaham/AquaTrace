
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SidebarProvider, Sidebar } from "@/components/ui/sidebar";
import SidebarNav from "@/components/dashboard/sidebar-nav";
import PageHeader from "@/components/dashboard/page-header";
import { useAssets } from "@/context/asset-context";
import { useToast } from "@/hooks/use-toast";
import { AssetForm, type AssetFormValues, type AssetPayload } from "@/components/asset-management/asset-form";
import { EditAssetDialog, DeleteAssetDialog } from "@/components/asset-management/asset-dialogs";
import { PlusCircle, ChevronDown, FilePenLine, Trash2 } from "lucide-react";
import { Asset, AssetStatus } from "@/lib/placeholder-data";

const statusVariantMap: Record<AssetStatus, { variant: "default" | "secondary" | "destructive" | "outline", text: string }> = {
  operating_as_expected: { variant: "default", text: "Operating As Expected" },
  minor_concerns: { variant: "secondary", text: "Minor Concerns" },
  critical_concerns: { variant: "destructive", text: "Critical Concerns" },
  unknown: { variant: "outline", text: "Unknown" },
};

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
            {assets.map((asset) => {
              const statusInfo = statusVariantMap[asset.status] || statusVariantMap.unknown;
              return (
                <TableRow key={asset.id}>
                  <TableCell className="font-medium">{asset.name}</TableCell>
                  <TableCell>{asset.location}</TableCell>
                  <TableCell>
                    <Badge variant={statusInfo.variant}>
                      {statusInfo.text}
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
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export default function AssetManagementPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { assets, setSelectedAssetId, createAsset, useAssetForm } = useAssets();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isAccordionOpen, setIsAccordionOpen] = React.useState(true);

  const form = useAssetForm({
    name: "",
    location: "",
    latitude: 0,
    longitude: 0,
    permanentPoolElevation: 0,
    designElevations: [],
    imageId: ""
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
