import { redirect } from "next/navigation";
import { requireConsoleAuth } from "@/shared/iam";
import { AppService } from "@/modules/apps";
import { ConsoleTopbar } from "@/ui/console/topbar";
import { ConsoleSidebarShell } from "@/ui/console/sidebar-shell";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  let auth;
  try {
    auth = await requireConsoleAuth();
  } catch {
    redirect("/login?redirectTo=/console");
  }

  const apps = await AppService.listOwnedOrAdmin(auth.user.id);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-cream-50 text-ink-900 dark:bg-slate-950 dark:text-slate-100">
      <ConsoleTopbar
        user={{ id: auth.user.id, username: auth.user.username, role: auth.user.role }}
        apps={apps.map((a) => ({ id: a.id, name: a.name, primaryDomain: a.primaryDomain }))}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ConsoleSidebarShell isSystemAdmin={auth.user.role === "admin"} />
        <main className="relative min-w-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(119,111,218,0.07),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.45),rgba(251,249,244,0))] dark:bg-[radial-gradient(circle_at_top_left,rgba(99,109,180,0.08),transparent_28%),linear-gradient(180deg,rgba(20,29,36,0.72),rgba(11,17,23,0))]">
          {children}
        </main>
      </div>
    </div>
  );
}
