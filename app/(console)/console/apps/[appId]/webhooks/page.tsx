import { notFound } from "next/navigation";
import { requireConsoleAuth } from "@/shared/iam";
import { prisma } from "@/shared/prisma";
import { AppService } from "@/modules/apps";
import { WebhooksService } from "@/modules/webhooks";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Badge } from "@/ui/primitives";
import { CreateWebhookForm, WebhookControls } from "@/ui/console/webhooks-actions";

export default async function WebhooksPage({ params }: { params: { appId: string } }) {
  const auth = await requireConsoleAuth();
  const app = await prisma.app.findUnique({
    where: { id: params.appId },
    include: { admins: true }
  });
  if (!app) notFound();
  if (auth.user.role !== "admin") {
    await AppService.requireOwnerOrAdmin(app.ownerId, app.admins, auth.user.id);
  }
  const hooks = await WebhooksService.listForApp(app.id);

  return (
    <div className="container-page py-8 space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Webhooks</h1>
        <p className="text-sm text-ink-500 mt-1">
          领域事件触发时，POST 到目标 URL。带 HMAC-SHA256 签名头，失败指数退避重试，6 次后入 DLQ。
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">新建 Webhook</CardTitle>
            <CardDescription>secret 自动生成，可后续轮换。</CardDescription>
          </CardHeader>
          <CardContent>
            <CreateWebhookForm appId={app.id} />
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-3">
          {hooks.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-sm text-ink-500">
                尚未创建任何 Webhook。
              </CardContent>
            </Card>
          )}
          {hooks.map((h) => {
            let events: string[] = [];
            try { events = JSON.parse(h.events) as string[]; } catch {}
            return (
              <Card key={h.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{h.name}</CardTitle>
                    <Badge tone={h.isActive ? "success" : "neutral"}>
                      {h.isActive ? "active" : "paused"}
                    </Badge>
                  </div>
                  <CardDescription className="font-mono truncate">{h.url}</CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-ink-500 space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {events.map((e) => (
                      <span key={e} className="font-mono px-1.5 py-0.5 bg-cream-100 rounded-sm">{e}</span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span>投递记录：{h._count.deliveries}</span>
                    <span>创建于 {new Date(h.createdAt * 1000).toLocaleString()}</span>
                  </div>
                  <WebhookControls
                    appId={app.id}
                    hookId={h.id}
                    isActive={h.isActive === 1}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
