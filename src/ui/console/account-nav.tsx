"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/ui/primitives";

const items = [
  { href: "/account", label: "授权应用" },
  { href: "/account/sessions", label: "会话" },
  { href: "/account/files", label: "我的文件" },
  { href: "/account/settings", label: "账号设置" }
];

export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-2 border-b border-ink-100 -mb-px">
      {items.map((it) => {
        const active = pathname === it.href;
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "px-3 py-3 text-sm border-b-2 transition-colors",
              active
                ? "border-ink-900 text-ink-900 font-medium"
                : "border-transparent text-ink-500 hover:text-ink-900"
            )}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
