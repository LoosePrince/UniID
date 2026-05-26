"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/ui/primitives";
import { cn } from "@/ui/primitives/utils";
import { type ThemeMode, useTheme } from "./theme-provider";

const themeOptions: Array<{
  value: ThemeMode;
  label: string;
  description: string;
  icon: typeof Monitor;
}> = [
  { value: "system", label: "自动", description: "跟随系统", icon: Monitor },
  { value: "light", label: "浅色", description: "暖色浅底", icon: Sun },
  { value: "dark", label: "深色", description: "冷色深底", icon: Moon }
];

const themeLabel: Record<ThemeMode, string> = {
  system: "自动",
  light: "浅色",
  dark: "深色"
};

export function ThemeToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { themeMode, resolvedTheme, setThemeMode } = useTheme();
  const CurrentIcon = resolvedTheme === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={compact ? "icon" : "sm"}
          className={cn(
            "shrink-0 border-ink-200/70 bg-cream-50/60 text-ink-700 dark:border-slate-600/60 dark:bg-slate-900/50 dark:text-slate-200",
            compact ? "h-9 w-9 rounded-lg" : "px-3",
            className
          )}
          aria-label="切换主题"
        >
          <CurrentIcon className="h-4 w-4" />
          {!compact && <span>{themeLabel[themeMode]}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuLabel>
          <span className="block text-sm">主题</span>
          <span className="mt-0.5 block text-2xs font-normal text-ink-400 dark:text-slate-500">
            当前为 {resolvedTheme === "dark" ? "深色" : "浅色"}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {themeOptions.map((option) => {
          const Icon = option.icon;
          const active = themeMode === option.value;

          return (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => setThemeMode(option.value)}
              className="justify-between"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <Icon className="h-4 w-4" />
                <span className="min-w-0">
                  <span className="block truncate">{option.label}</span>
                  <span className="block truncate text-2xs font-normal text-ink-400 dark:text-slate-500">
                    {option.description}
                  </span>
                </span>
              </span>
              {active && <Check className="h-4 w-4 text-accent-600 dark:text-accent-300" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}