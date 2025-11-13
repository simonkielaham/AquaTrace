import Link from "next/link";
import {
  LayoutDashboard,
  MapPin,
  Settings,
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
            <SidebarMenuButton href="#" isActive>
              <LayoutDashboard />
              Dashboard
            </SidebarMenuButton>
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
                isActive={asset.id === selectedAssetId}
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
            <SidebarMenuButton href="#">
              <Settings />
              Settings
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
