import { notFound } from "next/navigation";
import { normalizeLocale, createI18n } from "@/shared/i18n";
import { requireConsoleAuth } from "@/shared/iam";
import { prisma } from "@/shared/prisma";
import { AppService } from "@/modules/apps";
import { QuotaService } from "@/shared/quota";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Badge } from "@/ui/primitives";
import {
  ApiKeysPanel,
  BasicInfoForm,
  QuotaForm,
  DangerZone,
  AddDomainForm,
  DomainVerificationActions,
  RemoveDomainButton
} from "@/ui/console/settings-actions";

export default async function SettingsPage({ params }: { params: { appId: string } }) {
  const auth = await requireConsoleAuth();
  const { t } = createI18n(normalizeLocale(auth.user.locale));
  const app = await prisma.app.findUnique({
    where: { id: params.appId },
    include: { admins: true, domains: true, owner: true }
  });
  if (!app) notFound();
  if (auth.user.role !== "admin") {
    await AppService.requireOwnerOrAdmin(app.ownerId, app.admins, auth.user.id);
  }
  const isOwner = app.ownerId === auth.user.id;
  const isSystemAdmin = auth.user.role === "admin";
  const quota = await QuotaService.getOrDefault(app.id);
  const apiKeys = await AppService.listApiKeys(app.id);

  return (
    <div className="container-page py-8 space-y-6 max-w-3xl">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{t("appSettings.title")}</h1>
        <p className="text-sm text-ink-500 mt-1 dark:text-slate-400">{app.name} · {app.primaryDomain}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.basicTitle")}</CardTitle>
          <CardDescription>{t("settings.basicDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <BasicInfoForm
            appId={app.id}
            initial={{
              name: app.name,
              description: app.description,
              primaryDomain: app.primaryDomain
            }}
            canManageDomain={isSystemAdmin}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.domainsTitle")}</CardTitle>
          <CardDescription>{t("settings.domainsDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {app.domains.length === 0 && (
            <p className="text-sm text-ink-500 dark:text-slate-400">{t("settings.domainsEmpty")}</p>
          )}
          {app.domains.map((d) => (
            <div key={d.id} className="rounded-lg border border-ink-100 bg-white/40 px-3 py-2 text-sm dark:border-slate-700/70 dark:bg-slate-900/40">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono">{d.host}</span>
                <div className="flex items-center gap-2">
                  <Badge tone={d.verified ? "success" : "warning"}>
                    {d.verified ? t("common.verified") : t("common.pending")}
                  </Badge>
                  <RemoveDomainButton appId={app.id} domainId={d.id} host={d.host} disabled={!isSystemAdmin} />
                </div>
              </div>
              {!d.verified ? (
                <DomainVerificationActions
                  appId={app.id}
                  domain={{
                    id: d.id,
                    host: d.host,
                    verified: d.verified === 1,
                    verifyToken: d.verifyToken,
                    verification: AppService.domainVerificationRecord(d.host, d.verifyToken)
                  }}
                  canManualVerify={isSystemAdmin}
                />
              ) : null}
            </div>
          ))}
          <AddDomainForm appId={app.id} disabled={!isSystemAdmin} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.apiKeysTitle")}</CardTitle>
          <CardDescription>{t("settings.apiKeysDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ApiKeysPanel appId={app.id} keys={apiKeys} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.quotaTitle")}</CardTitle>
          <CardDescription>{t("settings.quotaDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <QuotaForm
            appId={app.id}
            quota={{
              rpsLimit: quota.rpsLimit,
              dailyApiCalls: quota.dailyApiCalls,
              monthlyStorageBytes: Number(quota.monthlyStorageBytes),
              monthlyEgressBytes: Number(quota.monthlyEgressBytes),
              fnInvocationsDaily: quota.fnInvocationsDaily
            }}
          />
        </CardContent>
      </Card>

      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-danger-700 dark:text-danger-100">{t("settings.dangerTitle")}</CardTitle>
            <CardDescription>{t("settings.dangerDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <DangerZone appId={app.id} appName={app.name} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
