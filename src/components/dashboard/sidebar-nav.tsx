
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MapPin,
  Settings,
  PlusCircle,
} from "lucide-react";
import {
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import Logo from "@/components/icons/logo";
import type { Asset } from "@/lib/placeholder-data";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type SidebarNavProps = {
  assets: Asset[];
  selectedAssetId: string;
  onSelectAsset: (id: string) => void;
};

const statusColorMap = {
  ok: "bg-green-500",
  warning: "bg-yellow-500",
  error: "bg-red-500",
};

export default function SidebarNav({
  assets,
  selectedAssetId,
  onSelectAsset,
}: SidebarNavProps) {
  const pathname = usePathname();
  const { toast } = useToast();

  const handleNotImplemented = () => {
    toast({
      title: "Feature not implemented",
      description: "This functionality is not yet available.",
    });
  };

  return (
    <>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <Logo className="h-8 w-8 text-primary" />
          <span className="font-headline text-lg font-semibold">AquaTrace</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <Link href="/" passHref>
              <SidebarMenuButton asChild isActive={pathname === "/"}>
                <span>
                  <LayoutDashboard />
                  Dashboard
                </span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Link href="/asset-management" passHref>
              <SidebarMenuButton asChild isActive={pathname === "/asset-management"}>
                <span>
                  <PlusCircle />
                  Asset Management
                </span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          <SidebarMenuItem className="px-2 pt-2 text-xs font-medium text-muted-foreground">
            Assets
          </SidebarMenuItem>
          {assets.map((asset) => (
            <SidebarMenuItem key={asset.id}>
              <SidebarMenuButton
                onClick={() => onSelectAsset(asset.id)}
                isActive={asset.id === selectedAssetId && pathname==='/'}
              >
                <MapPin />
                {asset.name}
                <Badge
                  className={`ml-auto h-2 w-2 p-0 ${
                    statusColorMap[asset.status]
                  }`}
                />
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleNotImplemented}>
              <Settings />
              Settings
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
