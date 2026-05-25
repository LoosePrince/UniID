import { redirect } from "next/navigation";
import { getCurrentUserSession } from "@/shared/iam";
import { prisma } from "@/shared/prisma";
import { AppService } from "@/modules/apps";
import { ConsoleTopbar } from "@/ui/console/topbar";
import { ConsoleSidebarShell } from "@/ui/console/sidebar-shell";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentUserSession();
  if (!session) redirect("/login?redirectTo=/console");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, username: true, role: true }
  });
  if (!user) redirect("/login?redirectTo=/console");

  const apps = await AppService.listOwnedOrAdmin(user.id);

  return (
    <div className="min-h-screen flex flex-col">
      <ConsoleTopbar
        user={{ id: user.id, username: user.username, role: user.role }}
        apps={apps.map((a) => ({ id: a.id, name: a.name, primaryDomain: a.primaryDomain }))}
      />
      <div className="flex-1 flex">
        <ConsoleSidebarShell isSystemAdmin={user.role === "admin"} />
        <main className="flex-1 bg-cream-50 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
