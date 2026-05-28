"use client";

import * as React from "react";
import { Command } from "cmdk";
import {
  Search,
  Database,
  Files,
  Settings,
  Users,
  Code2,
  Clock,
  Webhook,
  Radio,
  LogOut,
  Shield
} from "lucide-react";
import { useI18n } from "@/ui/i18n";
import { Dialog, DialogContent, DialogTitle } from "@/ui/primitives";
import { useNavigationTransition } from "@/ui/navigation";

export function CommandPalette({ appId, onLogout }: { appId?: string; onLogout: () => void }) {
  const { navigate } = useNavigationTransition();
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);

  const items = [
    { label: t("commandPalette.dataBrowser"), icon: Database, hint: "data" },
    { label: t("common.schemas"), icon: Shield, hint: "schemas" },
    { label: t("common.files"), icon: Files, hint: "files" },
    { label: t("common.functions"), icon: Code2, hint: "functions" },
    { label: t("common.cron"), icon: Clock, hint: "cron" },
    { label: t("common.webhooks"), icon: Webhook, hint: "webhooks" },
    { label: t("common.realtime"), icon: Radio, hint: "realtime" },
    { label: t("common.members"), icon: Users, hint: "members" },
    { label: t("common.settings"), icon: Settings, hint: "settings" }
  ];

  React.useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg p-0 [&_[data-dialog-close-wrapper]]:right-3 [&_[data-dialog-close-wrapper]]:top-2">
        <DialogTitle className="sr-only">{t("commandPalette.title")}</DialogTitle>
        <Command className="flex flex-col">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-ink-100 px-3 py-2.5 pr-16 dark:border-slate-700/70">
            <Search className="h-3.5 w-3.5 text-ink-400 dark:text-slate-400" />
            <Command.Input
              autoFocus
              placeholder={t("commandPalette.placeholder")}
              className="min-w-0 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            <span className="rounded-xs border border-ink-200 px-1.5 py-0.5 font-mono text-2xs text-ink-400 dark:border-slate-600/70 dark:text-slate-400">
              ⌘K
            </span>
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-1">
            <Command.Empty className="px-3 py-6 text-center text-xs text-ink-400 dark:text-slate-500">
              {t("commandPalette.empty")}
            </Command.Empty>
            <Command.Group heading={t("commandPalette.group.navigate")} className="text-2xs text-ink-400 dark:text-slate-400 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
              {items.map((it) => {
                const Icon = it.icon;
                const dest = appId ? `/console/apps/${appId}/${it.hint}` : "/console";
                return (
                  <Command.Item
                    key={it.label}
                    value={`${it.label} ${it.hint}`}
                    onSelect={() => {
                      setOpen(false);
                      navigate(dest);
                    }}
                    className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-ink-700 aria-selected:bg-ink-900 aria-selected:text-cream-50 data-[selected=true]:bg-ink-900 data-[selected=true]:text-cream-50 dark:text-slate-300 dark:aria-selected:bg-slate-700/80 dark:aria-selected:text-slate-100 dark:data-[selected=true]:bg-slate-700/80 dark:data-[selected=true]:text-slate-100 [&[aria-selected=true]_svg]:text-current [&[data-selected=true]_svg]:text-current"
                  >
                    <Icon className="h-3.5 w-3.5 text-ink-400 dark:text-slate-400" />
                    <span>{it.label}</span>
                  </Command.Item>
                );
              })}
            </Command.Group>
            <Command.Separator className="my-1 h-px bg-ink-100 dark:bg-slate-700/70" />
            <Command.Group heading={t("commandPalette.group.account")} className="text-2xs text-ink-400 dark:text-slate-400 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
              <Command.Item
                value={t("common.accountCenter")}
                onSelect={() => {
                  setOpen(false);
                  navigate("/console/account");
                }}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-ink-700 aria-selected:bg-ink-900 aria-selected:text-cream-50 data-[selected=true]:bg-ink-900 data-[selected=true]:text-cream-50 dark:text-slate-300 dark:aria-selected:bg-slate-700/80 dark:aria-selected:text-slate-100 dark:data-[selected=true]:bg-slate-700/80 dark:data-[selected=true]:text-slate-100 [&[aria-selected=true]_svg]:text-current [&[data-selected=true]_svg]:text-current"
              >
                <Users className="h-3.5 w-3.5 text-ink-400 dark:text-slate-400" />
                <span>{t("common.accountCenter")}</span>
              </Command.Item>
              <Command.Item
                value={t("common.logout")}
                onSelect={() => {
                  setOpen(false);
                  onLogout();
                }}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-danger-600 aria-selected:bg-danger-600 aria-selected:text-white data-[selected=true]:bg-danger-600 data-[selected=true]:text-white dark:text-danger-300 dark:aria-selected:bg-danger-500/25 dark:aria-selected:text-danger-100 dark:data-[selected=true]:bg-danger-500/25 dark:data-[selected=true]:text-danger-100 [&[aria-selected=true]_svg]:text-current [&[data-selected=true]_svg]:text-current"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>{t("common.logout")}</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
