"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Database,
  Files,
  Radio,
  Code2,
  Clock,
  Webhook,
  Shield,
  Users,
  Settings,
  type LucideIcon
} from "lucide-react";
import { cn } from "@/ui/primitives";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const APP_NAV = (appId: string): NavItem[] => [
  { href: `/console/apps/${appId}`, label: "概览", icon: LayoutDashboard },
  { href: `/console/apps/${appId}/schemas`, label: "Schemas", icon: Shield },
  { href: `/console/apps/${appId}/data`, label: "数据", icon: Database },
  { href: `/console/apps/${appId}/files`, label: "文件", icon: Files },
  { href: `/console/apps/${appId}/realtime`, label: "实时", icon: Radio },
  { href: `/console/apps/${appId}/functions`, label: "函数", icon: Code2 },
  { href: `/console/apps/${appId}/cron`, label: "定时", icon: Clock },
  { href: `/console/apps/${appId}/webhooks`, label: "Webhooks", icon: Webhook },
  { href: `/console/apps/${appId}/members`, label: "成员", icon: Users },
  { href: `/console/apps/${appId}/settings`, label: "设置", icon: Settings }
];

const ROOT_NAV: NavItem[] = [
  { href: "/console", label: "概览", icon: LayoutDashboard },
  { href: "/console/apps", label: "应用", icon: Database }
];

const ADMIN_NAV: NavItem[] = [
  { href: "/console/admin/users", label: "用户", icon: Users },
  { href: "/console/admin/apps", label: "全部应用", icon: Database },
  { href: "/console/admin/config", label: "全局配置", icon: Settings }
];

export function ConsoleSidebar({
  appId,
  isSystemAdmin
}: {
  appId?: string;
  isSystemAdmin: boolean;
}) {
  const pathname = usePathname();
  const items = appId ? APP_NAV(appId) : ROOT_NAV;

  return (
    <nav className="flex flex-col gap-0.5 px-2 py-3 text-sm">
      {items.map((item) => (
        <SidebarLink key={item.href} item={item} active={pathname === item.href || (item.href !== "/console" && pathname.startsWith(item.href))} />
      ))}
      {isSystemAdmin && (
        <>
          <div className="mt-4 mb-1 px-3 text-2xs uppercase tracking-wider font-medium text-ink-400">
            系统管理
          </div>
          {ADMIN_NAV.map((item) => (
            <SidebarLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
          ))}
        </>
      )}
    </nav>
  );
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-sm transition-colors",
        active ? "bg-cream-200 text-ink-900 font-medium" : "text-ink-600 hover:bg-cream-100 hover:text-ink-900"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}
