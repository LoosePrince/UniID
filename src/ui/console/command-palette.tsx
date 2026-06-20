"use client";

import * as React from "react";
import { Command } from "cmdk";
import {
  Search,
  AppWindow,
  Database,
  Files,
  Settings,
  Users,
  Code2,
  Clock,
  Webhook,
  Radio,
  LogOut,
  Shield,
  Workflow,
  FileText,
  KeyRound,
  Activity
} from "lucide-react";
import { useI18n } from "@/ui/i18n";
import { Dialog, DialogContent, DialogTitle } from "@/ui/primitives";
import { useNavigationTransition } from "@/ui/navigation";

type SearchItemType =
  | "app"
  | "schema"
  | "file"
  | "database"
  | "function"
  | "cron"
  | "webhook"
  | "api_key"
  | "audit";

interface SearchItem {
  id: string;
  type: SearchItemType;
  title: string;
  subtitle?: string;
  href: string;
}

interface SearchResponse {
  items?: SearchItem[];
  error?: { message?: string };
}

const itemClassName =
  "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-ink-700 aria-selected:bg-ink-900 aria-selected:text-cream-50 data-[selected=true]:bg-ink-900 data-[selected=true]:text-cream-50 dark:text-slate-300 dark:aria-selected:bg-slate-700/80 dark:aria-selected:text-slate-100 dark:data-[selected=true]:bg-slate-700/80 dark:data-[selected=true]:text-slate-100 [&[aria-selected=true]_svg]:text-current [&[data-selected=true]_svg]:text-current";

function resourceIcon(type: SearchItemType) {
  if (type === "app") return AppWindow;
  if (type === "schema") return Shield;
  if (type === "file") return FileText;
  if (type === "database") return Database;
  if (type === "function") return Code2;
  if (type === "cron") return Clock;
  if (type === "webhook") return Webhook;
  if (type === "api_key") return KeyRound;
  return Activity;
}

export function CommandPalette({ appId, onLogout }: { appId?: string; onLogout: () => void }) {
  const { navigate } = useNavigationTransition();
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [results, setResults] = React.useState<SearchItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);

  const items = [
    { label: t("commandPalette.dataBrowser"), icon: Database, hint: "data" },
    { label: t("common.schemas"), icon: Shield, hint: "schemas" },
    { label: t("common.policies"), icon: Shield, hint: "policies" },
    { label: t("common.business"), icon: Workflow, hint: "business" },
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

  React.useEffect(() => {
    if (!open) return;
    const term = search.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      setSearchError(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setSearchError(null);
      try {
        const params = new URLSearchParams({ q: term, limit: "12" });
        if (appId) params.set("appId", appId);
        const res = await fetch(`/api/v1/console/search?${params.toString()}`, {
          credentials: "include",
          signal: controller.signal
        });
        const json = (await res.json().catch(() => ({}))) as SearchResponse;
        if (!res.ok) throw new Error(json.error?.message ?? t("http.status", { status: String(res.status) }));
        setResults(json.items ?? []);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setResults([]);
        setSearchError(String((err as Error).message ?? err));
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [appId, open, search, t]);

  function closeAndNavigate(href: string) {
    setOpen(false);
    navigate(href);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg p-0 [&_[data-dialog-close-wrapper]]:right-3 [&_[data-dialog-close-wrapper]]:top-2">
        <DialogTitle className="sr-only">{t("commandPalette.title")}</DialogTitle>
        <Command className="flex flex-col">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-ink-100 px-3 py-2.5 pr-16 dark:border-slate-700/70">
            <Search className="h-3.5 w-3.5 text-ink-400 dark:text-slate-400" />
            <Command.Input
              autoFocus
              value={search}
              onValueChange={setSearch}
              placeholder={t("commandPalette.placeholder")}
              className="min-w-0 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            <span className="rounded-xs border border-ink-200 px-1.5 py-0.5 font-mono text-2xs text-ink-400 dark:border-slate-600/70 dark:text-slate-400">
              ⌘K
            </span>
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-1">
            {search.trim().length < 2 ? (
              <Command.Empty className="px-3 py-6 text-center text-xs text-ink-400 dark:text-slate-500">
                {t("commandPalette.empty")}
              </Command.Empty>
            ) : null}
            {search.trim().length >= 2 ? (
              <Command.Group heading={t("commandPalette.group.resources")} className="text-2xs text-ink-400 dark:text-slate-400 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                {loading ? (
                  <div className="px-2 py-2 text-xs text-ink-400 dark:text-slate-500">{t("commandPalette.searching")}</div>
                ) : null}
                {searchError ? (
                  <div className="px-2 py-2 text-xs text-danger-600 dark:text-danger-300">{t("commandPalette.searchError")}</div>
                ) : null}
                {!loading && !searchError && results.length === 0 ? (
                  <div className="px-2 py-2 text-xs text-ink-400 dark:text-slate-500">{t("commandPalette.noResources")}</div>
                ) : null}
                {results.map((item) => {
                  const Icon = resourceIcon(item.type);
                  return (
                    <Command.Item
                      key={`${item.type}:${item.id}`}
                      value={`${item.title} ${item.subtitle ?? ""} ${item.type} ${item.id}`}
                      onSelect={() => closeAndNavigate(item.href)}
                      className={itemClassName}
                    >
                      <Icon className="h-3.5 w-3.5 text-ink-400 dark:text-slate-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{item.title}</span>
                        {item.subtitle ? (
                          <span className="block truncate text-2xs text-ink-400 aria-selected:text-current dark:text-slate-500">
                            {item.subtitle}
                          </span>
                        ) : null}
                      </span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            ) : null}
            <Command.Group heading={t("commandPalette.group.navigate")} className="text-2xs text-ink-400 dark:text-slate-400 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
              {items.map((it) => {
                const Icon = it.icon;
                const dest = appId ? `/console/apps/${appId}/${it.hint}` : "/console";
                return (
                  <Command.Item
                    key={it.label}
                    value={`${it.label} ${it.hint}`}
                    onSelect={() => closeAndNavigate(dest)}
                    className={itemClassName}
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
                onSelect={() => closeAndNavigate("/console/account")}
                className={itemClassName}
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
