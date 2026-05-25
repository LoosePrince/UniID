"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
  LogOut
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/ui/primitives";

const ITEMS = [
  { label: "数据浏览器", href: "/console", icon: Database, hint: "data" },
  { label: "文件", href: "/console", icon: Files, hint: "files" },
  { label: "函数", href: "/console", icon: Code2, hint: "functions" },
  { label: "定时任务", href: "/console", icon: Clock, hint: "cron" },
  { label: "Webhooks", href: "/console", icon: Webhook, hint: "webhooks" },
  { label: "实时", href: "/console", icon: Radio, hint: "realtime" },
  { label: "成员", href: "/console", icon: Users, hint: "members" },
  { label: "设置", href: "/console", icon: Settings, hint: "settings" }
];

export function CommandPalette({ appId, onLogout }: { appId?: string; onLogout: () => void }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

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
      <DialogContent className="p-0 max-w-lg">
        <DialogTitle className="sr-only">命令面板</DialogTitle>
        <Command className="flex flex-col">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-ink-100">
            <Search className="h-3.5 w-3.5 text-ink-400" />
            <Command.Input
              autoFocus
              placeholder="搜索资源、跳转、操作…"
              className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-ink-400"
            />
            <span className="text-2xs font-mono text-ink-400 border border-ink-200 rounded-xs px-1.5 py-0.5">
              ⌘K
            </span>
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-1">
            <Command.Empty className="px-3 py-6 text-center text-xs text-ink-400">
              无匹配结果
            </Command.Empty>
            <Command.Group heading="跳转" className="text-2xs text-ink-400 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
              {ITEMS.map((it) => {
                const Icon = it.icon;
                const dest = appId ? `/console/apps/${appId}/${it.hint}` : `/console`;
                return (
                  <Command.Item
                    key={it.label}
                    value={`${it.label} ${it.hint}`}
                    onSelect={() => {
                      setOpen(false);
                      router.push(dest);
                    }}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm text-ink-700 aria-selected:bg-cream-100 cursor-pointer"
                  >
                    <Icon className="h-3.5 w-3.5 text-ink-400" />
                    <span>{it.label}</span>
                  </Command.Item>
                );
              })}
            </Command.Group>
            <Command.Separator className="h-px bg-ink-100 my-1" />
            <Command.Group heading="账号" className="text-2xs text-ink-400 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
              <Command.Item
                value="账号中心"
                onSelect={() => {
                  setOpen(false);
                  router.push("/account");
                }}
                className="flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm text-ink-700 aria-selected:bg-cream-100 cursor-pointer"
              >
                <Users className="h-3.5 w-3.5 text-ink-400" />
                <span>账号中心</span>
              </Command.Item>
              <Command.Item
                value="登出"
                onSelect={() => {
                  setOpen(false);
                  onLogout();
                }}
                className="flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm text-danger-600 aria-selected:bg-danger-50 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>登出</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
