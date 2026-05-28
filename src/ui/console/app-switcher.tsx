"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  cn
} from "@/ui/primitives";
import { useI18n } from "@/ui/i18n";
import { useNavigationTransition } from "@/ui/navigation";

export interface AppOption {
  id: string;
  name: string;
  primaryDomain: string;
}

export function AppSwitcher({ apps, currentAppId }: { apps: AppOption[]; currentAppId?: string }) {
  const { navigate } = useNavigationTransition();
  const { t } = useI18n();
  const current = apps.find((a) => a.id === currentAppId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="min-w-44 justify-between">
          <span className="truncate text-left">
            {current ? current.name : currentAppId ? currentAppId : t("appSwitcher.selectApp")}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-ink-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>{t("appSwitcher.managedApps")}</DropdownMenuLabel>
        {apps.length === 0 && (
          <p className="px-2 py-1.5 text-xs text-ink-400">{t("appSwitcher.empty")}</p>
        )}
        {apps.map((a) => (
          <DropdownMenuItem
            key={a.id}
            onSelect={() => navigate(`/console/apps/${a.id}`)}
            className={cn("flex items-center justify-between")}
          >
            <span className="min-w-0 flex flex-col">
              <span className="truncate">{a.name}</span>
              <span className="text-2xs text-ink-400 font-mono">{a.primaryDomain}</span>
            </span>
            {currentAppId === a.id && <Check className="h-3.5 w-3.5 text-accent-500" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => navigate("/console/apps/new")}
          className="text-accent-600 focus:text-accent-800 data-[highlighted]:text-accent-800 dark:text-accent-200 dark:focus:text-accent-100 dark:data-[highlighted]:text-accent-100"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("common.createApp")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
