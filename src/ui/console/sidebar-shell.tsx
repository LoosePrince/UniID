"use client";

import { usePathname } from "next/navigation";
import { ConsoleSidebar } from "./sidebar";

const APP_PATH_RE = /^\/console\/apps\/([^/]+)/;

export function ConsoleSidebarShell({ isSystemAdmin }: { isSystemAdmin: boolean }) {
  const pathname = usePathname();
  const match = APP_PATH_RE.exec(pathname ?? "");
  const appId = match?.[1];
  return (
    <aside className="w-64 shrink-0 border-r border-white/60 bg-cream-50/68 shadow-[inset_-1px_0_0_rgba(255,255,255,0.7)] backdrop-blur-xl">
      <ConsoleSidebar appId={appId} isSystemAdmin={isSystemAdmin} />
    </aside>
  );
}
