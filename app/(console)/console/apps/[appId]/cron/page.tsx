import { notFound } from "next/navigation";
import { requireConsoleAuth } from "@/shared/iam";
import { prisma } from "@/shared/prisma";
import { AppService } from "@/modules/apps";
import { CronService } from "@/modules/cron";
import { FunctionsService } from "@/modules/functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Badge } from "@/ui/primitives";
import { CreateCronForm, CronJobControls } from "@/ui/console/cron-actions";

export default async function CronPage({ params }: { params: { appId: string } }) {
  const auth = await requireConsoleAuth();
  const app = await prisma.app.findUnique({
    where: { id: params.appId },
    include: { admins: true }
  });
  if (!app) notFound();
  if (auth.user.role !== "admin") {
    await AppService.requireOwnerOrAdmin(app.ownerId, app.admins, auth.user.id);
  }
  const [jobs, fns] = await Promise.all([
    CronService.listForApp(app.id),
    FunctionsService.listForApp(app.id)
  ]);
  const fnMap = new Map(fns.map((f) => [f.id, f.name]));

  return (
    <div className="container-page py-8 space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">定时任务 (Cron)</h1>
        <p className="text-sm text-ink-500 mt-1">基于 5 字段 cron 表达式触发指定函数。</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">新建任务</CardTitle>
            <CardDescription>挑选已部署的函数并设置触发频率。</CardDescription>
          </CardHeader>
          <CardContent>
            <CreateCronForm
              appId={app.id}
              fns={fns.filter((f) => f.activeDeploymentId !== null).map((f) => ({ id: f.id, name: f.name }))}
            />
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-3">
          {jobs.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-sm text-ink-500">
                尚未创建任何定时任务。
              </CardContent>
            </Card>
          )}
          {jobs.map((j) => (
            <Card key={j.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{j.name}</CardTitle>
                  <Badge tone={j.isActive ? "success" : "neutral"}>
                    {j.isActive ? "active" : "paused"}
                  </Badge>
                </div>
                <CardDescription className="font-mono">{j.cronExpr}</CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-ink-500 space-y-2">
                <div className="flex items-center justify-between">
                  <span>函数：{fnMap.get(j.fnId) ?? j.fnId}</span>
                  <span>
                    最近执行：
                    {j.lastRunAt ? new Date(j.lastRunAt * 1000).toLocaleString() : "—"}
                    {j.lastStatus ? ` (${j.lastStatus})` : ""}
                  </span>
                </div>
                <CronJobControls
                  appId={app.id}
                  jobId={j.id}
                  isActive={j.isActive === 1}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
