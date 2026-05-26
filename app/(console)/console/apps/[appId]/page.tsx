import { notFound } from "next/navigation";
import { normalizeLocale, createI18n } from "@/shared/i18n";
import { requireConsoleAuth } from "@/shared/iam";
import { AppService } from "@/modules/apps";
import { prisma } from "@/shared/prisma";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/primitives";

export default async function AppOverviewPage({ params }: { params: { appId: string } }) {
  const auth = await requireConsoleAuth();
  const { t, formatNumber } = createI18n(normalizeLocale(auth.user.locale));
  const app = await prisma.app.findUnique({
    where: { id: params.appId },
    include: { domains: true, admins: true, quota: true }
  });
  if (!app) notFound();
  if (auth.user.role !== "admin") {
    await AppService.requireOwnerOrAdmin(app.ownerId, app.admins, auth.user.id);
  }

  const [recordsCount, filesCount, sessionsCount, schemasCount] = await Promise.all([
    prisma.record.count({ where: { appId: app.id, deletedAt: null } }),
    prisma.fileObject.count({ where: { appId: app.id, deletedAt: null } }),
    prisma.appSession.count({ where: { appId: app.id, revokedAt: null } }),
    prisma.dataSchema.count({ where: { appId: app.id } })
  ]);

  return (
    <div className="container-page py-8 space-y-6">
      <header>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{app.name}</h1>
          <Badge tone={app.status === "active" ? "success" : "warning"}>{app.status}</Badge>
        </div>
        <p className="text-sm text-ink-500 mt-1 font-mono">{app.primaryDomain}</p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label={t("appDetail.metric.records")} value={formatNumber(recordsCount)} />
        <MetricCard label={t("appDetail.metric.files")} value={formatNumber(filesCount)} />
        <MetricCard label={t("appDetail.metric.sessions")} value={formatNumber(sessionsCount)} />
        <MetricCard label={t("appDetail.metric.schemas")} value={formatNumber(schemasCount)} />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardHeader>
            <CardTitle>{t("appDetail.domains.title")}</CardTitle>
            <CardDescription>{t("appDetail.domains.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-mono">{app.primaryDomain}</span>
              <Badge tone="solid">{t("appDetail.domains.primary")}</Badge>
            </div>
            {app.domains.map((d) => (
              <div key={d.id} className="flex items-center justify-between">
                <span className="font-mono">{d.host}</span>
                <Badge tone={d.verified ? "success" : "warning"}>
                  {d.verified ? t("appDetail.domains.verified") : t("appDetail.domains.pending")}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("appDetail.quota.title")}</CardTitle>
            <CardDescription>{t("appDetail.quota.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row k={t("appDetail.quota.rps")} v={app.quota?.rpsLimit ?? "—"} />
            <Row k={t("appDetail.quota.dailyApi")} v={app.quota?.dailyApiCalls != null ? formatNumber(app.quota.dailyApiCalls) : "—"} />
            <Row
              k={t("appDetail.quota.storage")}
              v={app.quota?.monthlyStorageBytes != null ? formatNumber(Number(app.quota.monthlyStorageBytes)) : "—"}
            />
            <Row
              k={t("appDetail.quota.egress")}
              v={app.quota?.monthlyEgressBytes != null ? formatNumber(Number(app.quota.monthlyEgressBytes)) : "—"}
            />
            <Row
              k={t("appDetail.quota.functions")}
              v={app.quota?.fnInvocationsDaily != null ? formatNumber(app.quota.fnInvocationsDaily) : "—"}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-2xs uppercase tracking-wider text-ink-400">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-500">{k}</span>
      <span className="font-mono">{v}</span>
    </div>
  );
}
