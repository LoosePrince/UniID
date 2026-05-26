"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/ui/primitives";
import { useI18n } from "@/ui/i18n";

export function AccountNav() {
  const { t } = useI18n();
  const pathname = usePathname();
  const items = [
    { href: "/console/account", label: t("accountNav.authorizations") },
    { href: "/console/account/sessions", label: t("accountNav.sessions") },
    { href: "/console/account/files", label: t("accountNav.files") },
    { href: "/console/account/settings", label: t("accountNav.settings") }
  ];

  return (
    <nav className="-mb-px flex flex-wrap items-center gap-2 border-b border-ink-100 dark:border-slate-700/70">
      {items.map((it) => {
        const active = pathname === it.href;
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "px-3 py-3 text-sm border-b-2 transition-colors",
              active
                ? "border-ink-900 text-ink-900 font-medium dark:border-slate-300/70 dark:text-slate-100"
                : "border-transparent text-ink-500 hover:text-ink-900 dark:text-slate-400 dark:hover:text-slate-100"
            )}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
