"use client";

import { usePathname } from "next/navigation";
import { ConsoleSidebar } from "./sidebar";

const APP_PATH_RE = /^\/console\/apps\/([^/]+)/;

export function ConsoleSidebarShell({ isSystemAdmin }: { isSystemAdmin: boolean }) {
  const pathname = usePathname();
  const match = APP_PATH_RE.exec(pathname ?? "");
  const appId = match?.[1];
  return (
    <aside className="w-60 shrink-0 border-r border-ink-100 bg-cream-50">
      <ConsoleSidebar appId={appId} isSystemAdmin={isSystemAdmin} />
    </aside>
  );
}
