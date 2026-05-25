"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { LogOut, Search, User as UserIcon } from "lucide-react";
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

export function ConsoleTopbar(props: ConsoleTopbarProps) {
  const router = useRouter();
  const currentAppId = useCurrentAppId();

  async function logout() {
    try {
      await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" });
      toast.success("已登出");
      router.replace("/login");
    } catch {
      toast.error("登出失败");
    }
  }

  return (
    <header className="h-14 flex items-center justify-between gap-3 px-5 border-b border-ink-100 bg-cream-50">
      <div className="flex items-center gap-3">
        <Link href="/console" className="flex items-center gap-2">
          <span className="h-6 w-6 rounded-md bg-ink-900 text-cream-50 flex items-center justify-center font-bold text-xs">U</span>
          <span className="text-sm font-semibold tracking-tight">UniID Console</span>
        </Link>
        <span className="text-ink-200">/</span>
        <AppSwitcher apps={props.apps} currentAppId={currentAppId} />
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="min-w-52 justify-between text-ink-400 font-normal"
          onClick={() => {
            const ev = new KeyboardEvent("keydown", { key: "k", metaKey: true });
            window.dispatchEvent(ev);
          }}
        >
          <span className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5" />
            搜索 / 跳转
          </span>
          <span className="text-2xs font-mono border border-ink-200 rounded-xs px-1.5 py-0.5">⌘K</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="个人菜单">
              <UserIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuLabel>{props.user.username}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/account">账号中心</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/account/settings">个人设置</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={logout}
              className="text-danger-600 focus:bg-danger-50 focus:text-danger-700"
            >
              <LogOut className="h-3.5 w-3.5" />
              登出
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CommandPalette appId={currentAppId} onLogout={logout} />
    </header>
  );
}
