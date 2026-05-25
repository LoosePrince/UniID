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
    <nav className="flex flex-col gap-1 px-3 py-4 text-sm">
      {items.map((item) => (
        <SidebarLink
          key={item.href}
          item={item}
          active={pathname === item.href || (item.href !== "/console" && pathname.startsWith(item.href))}
        />
      ))}
      {isSystemAdmin && (
        <>
          <div className="mb-1 mt-5 px-3 text-2xs font-medium uppercase tracking-[0.16em] text-ink-400">
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
        "group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-[background,color,box-shadow,transform] duration-200",
        active
          ? "bg-white/78 text-ink-900 font-medium shadow-[0_10px_24px_rgba(19,17,14,0.07),inset_0_1px_0_rgba(255,255,255,0.82)]"
          : "text-ink-600 hover:-translate-y-px hover:bg-white/54 hover:text-ink-900"
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
          active ? "bg-ink-900 text-cream-50" : "bg-white/50 text-ink-500 group-hover:text-accent-700"
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="truncate">{item.label}</span>
    </Link>
  );
}
