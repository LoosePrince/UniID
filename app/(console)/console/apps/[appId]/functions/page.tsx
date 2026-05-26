import { notFound } from "next/navigation";
import { normalizeLocale, createI18n } from "@/shared/i18n";
import { requireConsoleAuth } from "@/shared/iam";
import { prisma } from "@/shared/prisma";
import { AppService } from "@/modules/apps";
import { FunctionsService } from "@/modules/functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Badge } from "@/ui/primitives";
import { CreateFunctionForm, FunctionRowActions } from "@/ui/console/functions-actions";

export default async function FunctionsPage({ params }: { params: { appId: string } }) {
  const auth = await requireConsoleAuth();
  const { t, formatDateTime } = createI18n(normalizeLocale(auth.user.locale));
  const app = await prisma.app.findUnique({
    where: { id: params.appId },
    include: { admins: true }
  });
  if (!app) notFound();
  if (auth.user.role !== "admin") {
    await AppService.requireOwnerOrAdmin(app.ownerId, app.admins, auth.user.id);
  }
  const fns = await FunctionsService.listForApp(app.id);
  const invocationsByFn = new Map(
    await Promise.all(fns.map(async (fn) => [fn.id, await FunctionsService.listInvocations(app.id, fn.id, 5)] as const))
  );

  return (
    <div className="container-page py-8 space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{t("common.functions")}</h1>
        <p className="text-sm text-ink-500 mt-1">{t("appFunctions.description")}</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">{t("page.functions.newTitle")}</CardTitle>
            <CardDescription>{t("page.functions.newCardDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <CreateFunctionForm appId={app.id} />
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-3">
          {fns.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-sm text-ink-500">
                {t("page.functions.empty")}
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
                      {fn.activeDeploymentId ? t("page.functions.deployed") : t("page.functions.notDeployed")}
                    </Badge>
                    <Badge tone={fn.isActive ? "success" : "neutral"}>
                      {fn.isActive ? t("common.active") : t("common.disabled")}
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
                  <span>{t("page.functions.updatedAt", { time: formatDateTime(fn.updatedAt) })}</span>
                </div>
                <FunctionRowActions appId={app.id} fn={fn} />
                <div className="rounded-md border border-ink-100 bg-cream-50">
                  <div className="border-b border-ink-100 px-3 py-2 text-xs font-medium text-ink-700">
                    {t("page.functions.recentInvocations")}
                  </div>
                  {(invocationsByFn.get(fn.id) ?? []).length === 0 ? (
                    <div className="px-3 py-3 text-xs text-ink-500">{t("page.functions.noInvocations")}</div>
                  ) : (
                    <div className="divide-y divide-ink-100">
                      {(invocationsByFn.get(fn.id) ?? []).map((inv) => (
                        <div key={inv.id} className="grid gap-2 px-3 py-2 text-xs sm:grid-cols-[1fr_auto]">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge tone={inv.status === "ok" ? "success" : "danger"}>{inv.status}</Badge>
                              <span className="font-mono text-ink-700">{inv.trigger}</span>
                              <span>{inv.durationMs}ms</span>
                            </div>
                            {inv.error ? <p className="mt-1 truncate text-danger-700">{inv.error}</p> : null}
                          </div>
                          <span className="text-ink-400">{formatDateTime(inv.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
