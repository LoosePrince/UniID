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
import { useI18n } from "@/ui/i18n";
import { cn } from "@/ui/primitives/utils";
import { type ThemeMode, useTheme } from "./theme-provider";

export function ThemeToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { t } = useI18n();
  const { themeMode, resolvedTheme, setThemeMode } = useTheme();
  const CurrentIcon = resolvedTheme === "dark" ? Moon : Sun;
  const themeOptions: Array<{
    value: ThemeMode;
    label: string;
    description: string;
    icon: typeof Monitor;
  }> = [
    {
      value: "system",
      label: t("theme.system.label"),
      description: t("theme.system.description"),
      icon: Monitor
    },
    {
      value: "light",
      label: t("theme.light.label"),
      description: t("theme.light.description"),
      icon: Sun
    },
    {
      value: "dark",
      label: t("theme.dark.label"),
      description: t("theme.dark.description"),
      icon: Moon
    }
  ];

  const themeLabel: Record<ThemeMode, string> = {
    system: t("theme.system.label"),
    light: t("theme.light.label"),
    dark: t("theme.dark.label")
  };

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
          aria-label={t("theme.aria")}
        >
          <CurrentIcon className="h-4 w-4" />
          {!compact && <span>{themeLabel[themeMode]}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuLabel>
          <span className="block text-sm">{t("theme.title")}</span>
          <span className="mt-0.5 block text-2xs font-normal text-ink-400 dark:text-slate-500">
            {t("theme.current", { theme: themeLabel[resolvedTheme] })}
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