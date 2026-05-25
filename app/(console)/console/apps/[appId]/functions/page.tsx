import { notFound } from "next/navigation";
import { requireConsoleAuth } from "@/shared/iam";
import { prisma } from "@/shared/prisma";
import { AppService } from "@/modules/apps";
import { FunctionsService } from "@/modules/functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Badge } from "@/ui/primitives";
import { CreateFunctionForm, DeployButton } from "@/ui/console/functions-actions";

export default async function FunctionsPage({ params }: { params: { appId: string } }) {
  const auth = await requireConsoleAuth();
  const app = await prisma.app.findUnique({
    where: { id: params.appId },
    include: { admins: true }
  });
  if (!app) notFound();
  if (auth.user.role !== "admin") {
    await AppService.requireOwnerOrAdmin(app.ownerId, app.admins, auth.user.id);
  }
  const fns = await FunctionsService.listForApp(app.id);

  return (
    <div className="container-page py-8 space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">函数 (Edge Functions)</h1>
        <p className="text-sm text-ink-500 mt-1">
          上传 JavaScript 源码，运行在 QuickJS 沙箱里。可通过 SDK / Cron / Webhooks 调用。
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">新建函数</CardTitle>
            <CardDescription>函数名作为外部调用的标识。</CardDescription>
          </CardHeader>
          <CardContent>
            <CreateFunctionForm appId={app.id} />
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-3">
          {fns.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-sm text-ink-500">
                尚未创建任何函数。
              </CardContent>
            </Card>
          )}
          {fns.map((fn) => (
            <Card key={fn.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="font-mono text-sm">{fn.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge tone={fn.activeDeploymentId ? "success" : "warning"}>
                      {fn.activeDeploymentId ? "已部署" : "无部署"}
                    </Badge>
                    <Badge tone={fn.isActive ? "success" : "neutral"}>
                      {fn.isActive ? "active" : "disabled"}
                    </Badge>
                  </div>
                </div>
                <CardDescription>{fn.description ?? "—"}</CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-ink-500 space-y-2">
                <div className="flex items-center justify-between">
                  <span>
                    {fn.memoryMb}MB / {fn.timeoutMs}ms
                  </span>
                  <span>更新于 {new Date(fn.updatedAt * 1000).toLocaleString()}</span>
                </div>
                <DeployButton appId={app.id} fnId={fn.id} />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
