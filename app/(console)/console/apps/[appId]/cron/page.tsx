import { notFound } from "next/navigation";
import { normalizeLocale, createI18n } from "@/shared/i18n";
import { requireConsoleAuth } from "@/shared/iam";
import { prisma } from "@/shared/prisma";
import { AppService } from "@/modules/apps";
import { CronService } from "@/modules/cron";
import { FunctionsService } from "@/modules/functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Badge } from "@/ui/primitives";
import { CreateCronForm, CronJobControls } from "@/ui/console/cron-actions";

export default async function CronPage({ params }: { params: { appId: string } }) {
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
  const [jobs, fns] = await Promise.all([
    CronService.listForApp(app.id),
    FunctionsService.listForApp(app.id)
  ]);
  const fnMap = new Map(fns.map((f) => [f.id, f.name]));

  return (
    <div className="container-page py-8 space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{t("common.cron")}</h1>
        <p className="text-sm text-ink-500 mt-1">{t("appCron.description")}</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">{t("page.cron.newCardTitle")}</CardTitle>
            <CardDescription>{t("page.cron.newCardDesc")}</CardDescription>
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
                {t("page.cron.empty")}
              </CardContent>
            </Card>
          )}
          {jobs.map((j) => (
            <Card key={j.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{j.name}</CardTitle>
                  <Badge tone={j.isActive ? "success" : "neutral"}>
                    {j.isActive ? t("common.active") : t("common.paused")}
                  </Badge>
                </div>
                <CardDescription className="font-mono">{j.cronExpr}</CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-ink-500 space-y-2">
                <div className="flex items-center justify-between">
                  <span>{t("page.cron.functionLabel", { name: fnMap.get(j.fnId) ?? j.fnId })}</span>
                  <span>
                    {t("page.cron.lastRun", {
                      time: j.lastRunAt ? formatDateTime(j.lastRunAt) : "—",
                      status: j.lastStatus ? ` (${j.lastStatus})` : ""
                    })}
                  </span>
                </div>
                <CronJobControls
                  appId={app.id}
                  job={{
                    id: j.id,
                    name: j.name,
                    cronExpr: j.cronExpr,
                    fnId: j.fnId,
                    payload: j.payload,
                    isActive: j.isActive
                  }}
                  fns={fns.filter((f) => f.activeDeploymentId !== null).map((f) => ({ id: f.id, name: f.name }))}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
