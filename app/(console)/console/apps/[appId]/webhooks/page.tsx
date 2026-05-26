import { notFound } from "next/navigation";
import { normalizeLocale, createI18n } from "@/shared/i18n";
import { requireConsoleAuth } from "@/shared/iam";
import { prisma } from "@/shared/prisma";
import { AppService } from "@/modules/apps";
import { WebhooksService } from "@/modules/webhooks";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Badge } from "@/ui/primitives";
import { CreateWebhookForm, DeliveryRetryButton, WebhookControls } from "@/ui/console/webhooks-actions";

export default async function WebhooksPage({ params }: { params: { appId: string } }) {
  const auth = await requireConsoleAuth();
  const { t, formatDateTime, formatNumber } = createI18n(normalizeLocale(auth.user.locale));
  const app = await prisma.app.findUnique({
    where: { id: params.appId },
    include: { admins: true }
  });
  if (!app) notFound();
  if (auth.user.role !== "admin") {
    await AppService.requireOwnerOrAdmin(app.ownerId, app.admins, auth.user.id);
  }
  const hooks = await WebhooksService.listForApp(app.id);
  const deliveriesByHook = new Map(
    await Promise.all(hooks.map(async (hook) => [hook.id, await WebhooksService.listDeliveries(app.id, hook.id, 5)] as const))
  );

  return (
    <div className="container-page py-8 space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{t("common.webhooks")}</h1>
        <p className="text-sm text-ink-500 mt-1">{t("appWebhooks.description")}</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">{t("page.webhooks.newTitle")}</CardTitle>
            <CardDescription>{t("page.webhooks.newDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <CreateWebhookForm appId={app.id} />
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-3">
          {hooks.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-sm text-ink-500">
                {t("page.webhooks.empty")}
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
                      {h.isActive ? t("common.active") : t("common.paused")}
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
                    <span>{t("page.webhooks.deliveryCount", { count: formatNumber(h._count.deliveries) })}</span>
                    <span>{t("page.webhooks.createdAt", { time: formatDateTime(h.createdAt) })}</span>
                  </div>
                  <WebhookControls
                    appId={app.id}
                    hook={{
                      id: h.id,
                      name: h.name,
                      url: h.url,
                      events,
                      isActive: h.isActive
                    }}
                  />
                  <div className="rounded-md border border-ink-100 bg-cream-50">
                    <div className="border-b border-ink-100 px-3 py-2 text-xs font-medium text-ink-700">
                      {t("page.webhooks.deliveries")}
                    </div>
                    {(deliveriesByHook.get(h.id) ?? []).length === 0 ? (
                      <div className="px-3 py-3 text-xs text-ink-500">{t("page.webhooks.noDeliveries")}</div>
                    ) : (
                      <div className="divide-y divide-ink-100">
                        {(deliveriesByHook.get(h.id) ?? []).map((delivery) => (
                          <div key={delivery.id} className="grid gap-2 px-3 py-2 text-xs lg:grid-cols-[1fr_auto]">
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge
                                  tone={
                                    delivery.status === "success"
                                      ? "success"
                                      : delivery.status === "pending"
                                        ? "warning"
                                        : "danger"
                                  }
                                >
                                  {delivery.status}
                                </Badge>
                                <span className="font-mono text-ink-700">{delivery.eventType}</span>
                                <span>attempt {delivery.attempt}</span>
                                {delivery.statusCode ? <span>HTTP {delivery.statusCode}</span> : null}
                                {delivery.durationMs ? <span>{delivery.durationMs}ms</span> : null}
                              </div>
                              {delivery.errorMessage ? <p className="truncate text-danger-700">{delivery.errorMessage}</p> : null}
                            </div>
                            <div className="flex items-center justify-between gap-2 lg:justify-end">
                              <span className="text-ink-400">{formatDateTime(delivery.createdAt)}</span>
                              <DeliveryRetryButton
                                appId={app.id}
                                hookId={h.id}
                                deliveryId={delivery.id}
                                status={delivery.status}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
