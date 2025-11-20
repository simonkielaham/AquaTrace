
import type { Asset } from "@/lib/placeholder-data";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Target, Globe, FilePenLine, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { EditAssetDialog, DeleteAssetDialog } from "@/app/asset-management/page";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import React from 'react';

type AssetOverviewProps = {
  asset: Asset;
};

const statusVariantMap = {
  ok: "default",
  warning: "secondary",
  error: "destructive",
} as const;

export default function AssetOverview({ asset }: AssetOverviewProps) {
  const image = PlaceHolderImages.find((img) => img.id === asset.imageId);
  const router = useRouter();
  const [_, startTransition] = React.useTransition();

  return (
    <Card className="col-span-1 lg:col-span-2 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex-1">
          <CardTitle className="font-headline">{asset.name}</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusVariantMap[asset.status]} className="capitalize">
            {asset.status}
          </Badge>
          <EditAssetDialog asset={asset}>
             <Button variant="ghost" size="icon" title="Edit Asset">
                <FilePenLine className="h-4 w-4" />
                <span className="sr-only">Edit</span>
              </Button>
          </EditAssetDialog>
           <DeleteAssetDialog asset={asset} onDeleted={() => {
                startTransition(() => {
                    router.refresh(); 
                });
            }}>
                <Button variant="ghost" size="icon" title="Delete Asset">
                    <Trash2 className="h-4 w-4 text-destructive" />
                    <span className="sr-only">Delete</span>
                </Button>
          </DeleteAssetDialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-4">
            <div className="flex items-center space-x-2">
              <MapPin className="h-4 w-4" />
              <span>{asset.location}</span>
            </div>
             {typeof asset.latitude === 'number' && typeof asset.longitude === 'number' && (
                <div className="flex items-center space-x-2">
                    <Globe className="h-4 w-4" />
                    <span>{asset.latitude.toFixed(4)}, {asset.longitude.toFixed(4)}</span>
                </div>
            )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {image && (
            <div className="md:col-span-1 rounded-lg overflow-hidden">
              <Image
                src={image.imageUrl}
                alt={image.description}
                width={400}
                height={300}
                data-ai-hint={image.imageHint}
                className="object-cover w-full h-full"
              />
            </div>
          )}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-start space-x-3 rounded-lg border p-3">
              <Target className="h-5 w-5 mt-1 text-primary" />
              <div>
                <h4 className="font-semibold">Permanent Pool Elevation</h4>
                <p className="text-2xl font-bold font-headline text-primary">
                  {asset.permanentPoolElevation.toFixed(2)}{" "}
                  <span className="text-sm font-body font-normal text-muted-foreground">
                    meters
                  </span>
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Design Elevations</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {asset.designElevations.map((de) => (
                  <div key={de.name} className="flex justify-between rounded-md bg-muted/50 p-2">
                    <span className="text-muted-foreground">{de.name}:</span>
                    <span className="font-semibold">{de.elevation.toFixed(2)}m</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
