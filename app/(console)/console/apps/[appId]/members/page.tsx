import { notFound } from "next/navigation";
import { requireConsoleAuth } from "@/shared/iam";
import { prisma } from "@/shared/prisma";
import { AppService } from "@/modules/apps";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/primitives";
import { AddMemberForm, RemoveMemberButton } from "@/ui/console/members-actions";

export default async function MembersPage({ params }: { params: { appId: string } }) {
  const auth = await requireConsoleAuth();
  const app = await prisma.app.findUnique({
    where: { id: params.appId },
    include: {
      owner: { select: { id: true, username: true, displayName: true } },
      admins: { include: { user: { select: { id: true, username: true, displayName: true } } } }
    }
  });
  if (!app) notFound();
  if (auth.user.role !== "admin") {
    await AppService.requireOwnerOrAdmin(
      app.ownerId,
      app.admins.map((a) => ({ userId: a.userId })),
      auth.user.id
    );
  }

  return (
    <div className="container-page py-8 space-y-6 max-w-3xl">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">成员</h1>
        <p className="text-sm text-ink-500 mt-1 dark:text-slate-400">
          管理可访问该应用控制台的协作者。owner 拥有最高权限，无法被移除。
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">添加成员</CardTitle>
          <CardDescription>通过 UniID 用户名添加（被添加者需先在 UniID 注册）。</CardDescription>
        </CardHeader>
        <CardContent>
          <AddMemberForm appId={app.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">当前成员</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between rounded-lg border border-ink-100 bg-cream-50 px-3 py-2 dark:border-slate-700/70 dark:bg-slate-900/50">
            <div>
              <p className="text-sm font-medium">{app.owner?.displayName ?? app.owner?.username}</p>
              <p className="text-2xs text-ink-500 font-mono dark:text-slate-400">@{app.owner?.username}</p>
            </div>
            <Badge tone="solid">owner</Badge>
          </div>
          {app.admins.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-lg border border-ink-100 bg-white/40 px-3 py-2 transition-colors hover:bg-cream-50 dark:border-slate-700/70 dark:bg-slate-900/40 dark:hover:bg-slate-800/50">
              <div>
                <p className="text-sm font-medium text-ink-900 dark:text-slate-100">
                  {a.user.displayName ?? a.user.username}
                </p>
                <p className="text-2xs text-ink-500 font-mono dark:text-slate-400">@{a.user.username}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="accent">admin</Badge>
                <RemoveMemberButton appId={app.id} userId={a.user.id} username={a.user.username} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
