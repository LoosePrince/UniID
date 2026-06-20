"use client";

import { usePathname } from "next/navigation";
import { TransitionLink } from "@/ui/navigation";
import {
  LayoutDashboard,
  Database,
  Files,
  Radio,
  Code2,
  Clock,
  Webhook,
  Shield,
  ClipboardList,
  Users,
  Settings,
  BookOpen,
  Workflow,
  type LucideIcon
} from "lucide-react";
import { useI18n } from "@/ui/i18n";
import { cn } from "@/ui/primitives";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export function ConsoleSidebar({
  appId,
  isSystemAdmin
}: {
  appId?: string;
  isSystemAdmin: boolean;
}) {
  const pathname = usePathname();
  const { t } = useI18n();

  const appNav: NavItem[] = appId
    ? [
        { href: `/console/apps/${appId}`, label: t("common.overview"), icon: LayoutDashboard },
        { href: `/console/apps/${appId}/schemas`, label: t("common.schemas"), icon: Shield },
        { href: `/console/apps/${appId}/policies`, label: t("common.policies"), icon: Shield },
        { href: `/console/apps/${appId}/business`, label: t("common.business"), icon: Workflow },
        { href: `/console/apps/${appId}/data`, label: t("common.data"), icon: Database },
        { href: `/console/apps/${appId}/files`, label: t("common.files"), icon: Files },
        { href: `/console/apps/${appId}/realtime`, label: t("common.realtime"), icon: Radio },
        { href: `/console/apps/${appId}/functions`, label: t("common.functions"), icon: Code2 },
        { href: `/console/apps/${appId}/cron`, label: t("common.cron"), icon: Clock },
        { href: `/console/apps/${appId}/webhooks`, label: t("common.webhooks"), icon: Webhook },
        { href: `/console/apps/${appId}/audit`, label: t("common.auditLogs"), icon: ClipboardList },
        { href: `/console/apps/${appId}/members`, label: t("common.members"), icon: Users },
        { href: "/docs", label: t("common.docs"), icon: BookOpen },
        { href: `/console/apps/${appId}/settings`, label: t("common.settings"), icon: Settings }
      ]
    : [];

  const rootNav: NavItem[] = [
    { href: "/console", label: t("common.overview"), icon: LayoutDashboard },
    { href: "/console/apps", label: t("common.apps"), icon: Database },
    { href: "/docs", label: t("common.docs"), icon: BookOpen }
  ];

  const adminNav: NavItem[] = [
    { href: "/console/admin/users", label: t("common.users"), icon: Users },
    { href: "/console/admin/apps", label: t("common.allApps"), icon: Database },
    { href: "/console/admin/config", label: t("common.globalConfig"), icon: Settings }
  ];

  const items = appId ? appNav : rootNav;

  function isActive(item: NavItem) {
    if (!pathname) return false;
    if (item.href === "/docs") return pathname === item.href || pathname.startsWith("/docs/");
    if (appId && item.href === `/console/apps/${appId}`) return pathname === item.href;
    if (item.href === "/console") return pathname === "/console";
    if (item.href === "/console/apps") return pathname === item.href || pathname === "/console/apps/new";
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  return (
    <nav className="flex flex-col gap-0 px-2 py-2 text-sm">
      {items.map((item) => (
        <SidebarLink
          key={item.href}
          item={item}
          active={isActive(item)}
        />
      ))}
      {isSystemAdmin && (
        <>
          <div className="mb-1 mt-2 px-2.5 text-2xs font-medium uppercase tracking-[0.16em] text-ink-400">
            {t("sidebar.systemAdmin")}
          </div>
          {adminNav.map((item) => (
            <SidebarLink key={item.href} item={item} active={isActive(item)} />
          ))}
        </>
      )}
    </nav>
  );
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <TransitionLink
      href={item.href}
      className={cn(
        "group relative flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-[background,color,box-shadow,transform] duration-200",
        active
          ? "bg-white/75 text-ink-900 font-medium shadow-[0_7px_18px_rgba(19,17,14,0.055),inset_0_1px_0_rgba(255,255,255,0.82)] dark:bg-slate-800/70 dark:text-slate-100 dark:shadow-[inset_0_0_0_1px_rgba(129,148,163,0.18)]"
          : "text-ink-600 hover:bg-white/50 hover:text-ink-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-100"
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-md transition-colors",
          active ? "bg-ink-900 text-cream-50 dark:bg-slate-100 dark:text-slate-950" : "bg-white/50 text-ink-500 group-hover:text-accent-700 dark:bg-slate-800/60 dark:text-slate-400 dark:group-hover:text-accent-200"
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="truncate">{item.label}</span>
    </TransitionLink>
  );
}
