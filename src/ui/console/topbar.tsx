"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Home, LogOut, Search, Settings, User as UserIcon } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  toast
} from "@/ui/primitives";
import { useI18n } from "@/ui/i18n";
import { ThemeToggle } from "@/ui/theme";
import { AppSwitcher, type AppOption } from "./app-switcher";
import { CommandPalette } from "./command-palette";

export interface ConsoleTopbarProps {
  user: { id: string; username: string; role: string };
  apps: AppOption[];
}

const APP_PATH_RE = /^\/console\/apps\/([^/]+)/;

function useCurrentAppId(): string | undefined {
  const pathname = usePathname();
  const match = APP_PATH_RE.exec(pathname ?? "");
  return match?.[1];
}

function useSectionLabel() {
  const pathname = usePathname() ?? "/console";
  const { t } = useI18n();

  if (pathname.startsWith("/console/account")) return t("common.account");
  if (pathname.startsWith("/console/admin")) return t("common.systemAdmin");
  if (pathname.startsWith("/console/apps")) return t("common.apps");
  return t("common.console");
}

export function ConsoleTopbar(props: ConsoleTopbarProps) {
  const router = useRouter();
  const { t } = useI18n();
  const currentAppId = useCurrentAppId();
  const sectionLabel = useSectionLabel();

  async function logout() {
    try {
      await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" });
      toast.success(t("topbar.loggedOut"));
      router.replace("/login");
    } catch {
      toast.error(t("topbar.logoutFailed"));
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-white/60 bg-cream-50/72 px-5 shadow-[0_10px_30px_rgba(19,17,14,0.04)] backdrop-blur-xl supports-[backdrop-filter]:bg-cream-50/60 dark:border-slate-700/60 dark:bg-slate-950/72 dark:shadow-[0_10px_30px_rgba(0,0,0,0.16)] dark:supports-[backdrop-filter]:bg-slate-950/60">
      <div className="flex min-w-0 items-center gap-3">
        <Link href="/console" className="group flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-ink-900 text-xs font-bold text-cream-50 shadow-[0_12px_26px_rgba(19,17,14,0.16),inset_0_1px_0_rgba(255,255,255,0.12)] transition-transform group-hover:-translate-y-0.5">
            U
          </span>
          <span className="hidden text-sm font-semibold tracking-tight sm:inline">{t("app.consoleName")}</span>
        </Link>
        <span className="hidden text-ink-200 dark:text-slate-700 sm:inline">/</span>
        <span className="hidden rounded-full border border-ink-200/70 bg-white/50 px-2.5 py-1 text-xs font-medium text-ink-500 shadow-xs sm:inline-flex dark:border-slate-700/60 dark:bg-slate-900/50 dark:text-slate-400">
          {sectionLabel}
        </span>
        <div className="hidden sm:block">
          <AppSwitcher apps={props.apps} currentAppId={currentAppId} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="hidden min-w-52 justify-between font-normal text-ink-400 md:inline-flex"
          onClick={() => {
            const ev = new KeyboardEvent("keydown", { key: "k", metaKey: true });
            window.dispatchEvent(ev);
          }}
        >
          <span className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5" />
            {t("common.searchAndJump")}
          </span>
          <span className="rounded-md border border-ink-200/80 bg-white/60 px-1.5 py-0.5 font-mono text-2xs text-ink-400 dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-500">⌘K</span>
        </Button>

        <ThemeToggle compact />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" aria-label={t("topbar.personalMenu")} className="gap-2">
              <UserIcon className="h-4 w-4" />
              <span className="hidden max-w-28 truncate sm:inline">{props.user.username}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuLabel>
              <span className="block truncate">{props.user.username}</span>
              <span className="mt-0.5 block text-2xs font-normal text-ink-400 dark:text-slate-500">{props.user.role}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/">
                <Home className="h-3.5 w-3.5" />
                {t("topbar.goHome")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/console/account">
                <UserIcon className="h-3.5 w-3.5" />
                {t("common.accountCenter")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/console/account/settings">
                <Settings className="h-3.5 w-3.5" />
                {t("topbar.accountSettings")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={logout}
              className="text-danger-600 focus:bg-danger-50 focus:text-danger-700 dark:text-danger-100 dark:focus:bg-danger-700/30 dark:focus:text-danger-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              {t("common.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CommandPalette appId={currentAppId} onLogout={logout} />
    </header>
  );
}
