import { notFound } from "next/navigation";
import { AlertTriangle, DatabaseZap, Globe2, KeyRound, Settings2, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { normalizeLocale, createI18n } from "@/shared/i18n";
import { requireConsoleAuth } from "@/shared/iam";
import { prisma } from "@/shared/prisma";
import { AppService } from "@/modules/apps";
import { QuotaService } from "@/shared/quota";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/primitives";
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
  const { t, formatBytes, formatNumber } = createI18n(normalizeLocale(auth.user.locale));
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
  const activeKeys = apiKeys.filter((key) => key.revokedAt == null).length;
  const verifiedDomains = app.domains.filter((domain) => domain.verified === 1).length;
  const roleLabel = isSystemAdmin
    ? t("settings.role.systemAdmin")
    : isOwner
      ? t("settings.role.owner")
      : t("settings.role.appAdmin");

  return (
    <div className="container-page py-8 space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">{t("appSettings.title")}</h1>
          <p className="mt-1 truncate text-sm text-ink-500 dark:text-slate-400">
            {app.name} · {app.primaryDomain}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={app.status === "active" ? "success" : "warning"}>{app.status}</Badge>
          <Badge tone={isSystemAdmin ? "accent" : "neutral"}>{roleLabel}</Badge>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-4">
        <SettingsMetric label={t("settings.metric.owner")} value={app.owner.username} icon={<ShieldCheck className="h-4 w-4" />} />
        <SettingsMetric
          label={t("settings.metric.domains")}
          value={`${formatNumber(verifiedDomains)} / ${formatNumber(app.domains.length)}`}
          icon={<Globe2 className="h-4 w-4" />}
        />
        <SettingsMetric label={t("settings.metric.activeKeys")} value={formatNumber(activeKeys)} icon={<KeyRound className="h-4 w-4" />} />
        <SettingsMetric
          label={t("settings.metric.storageQuota")}
          value={formatBytes(Number(quota.monthlyStorageBytes))}
          icon={<DatabaseZap className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden xl:block">
          <nav className="sticky top-24 space-y-1 text-sm">
            <SettingsAnchor href="#basic" icon={<Settings2 className="h-3.5 w-3.5" />} label={t("settings.basicTitle")} />
            <SettingsAnchor href="#domains" icon={<Globe2 className="h-3.5 w-3.5" />} label={t("settings.domainsTitle")} />
            <SettingsAnchor href="#api-keys" icon={<KeyRound className="h-3.5 w-3.5" />} label={t("settings.apiKeysTitle")} />
            <SettingsAnchor href="#quota" icon={<SlidersHorizontal className="h-3.5 w-3.5" />} label={t("settings.quotaTitle")} />
            {isOwner ? <SettingsAnchor href="#danger" icon={<AlertTriangle className="h-3.5 w-3.5" />} label={t("settings.dangerTitle")} danger /> : null}
          </nav>
        </aside>

        <div className="min-w-0 space-y-6">
          <Card id="basic" className="scroll-mt-24">
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

          <Card id="domains" className="scroll-mt-24">
            <CardHeader>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-base">{t("settings.domainsTitle")}</CardTitle>
                  <CardDescription>{t("settings.domainsDescription")}</CardDescription>
                </div>
                <Badge tone={verifiedDomains === app.domains.length ? "success" : "warning"}>
                  {t("settings.verifiedCount", { count: formatNumber(verifiedDomains) })}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-ink-100 bg-cream-50/70 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/30">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-mono">{app.primaryDomain}</span>
                  <Badge tone="solid">{t("settings.primary")}</Badge>
                </div>
              </div>
              {app.domains.length === 0 && <p className="text-sm text-ink-500 dark:text-slate-400">{t("settings.domainsEmpty")}</p>}
              {app.domains.map((domain) => (
                <div
                  key={domain.id}
                  className="rounded-lg border border-ink-100 bg-white/40 px-3 py-2 text-sm dark:border-slate-700/70 dark:bg-slate-900/40"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="min-w-0 truncate font-mono">{domain.host}</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={domain.verified === 1 ? "success" : "warning"}>
                        {domain.verified === 1 ? t("common.verified") : t("common.pending")}
                      </Badge>
                      <RemoveDomainButton appId={app.id} domainId={domain.id} host={domain.host} disabled={!isSystemAdmin} />
                    </div>
                  </div>
                  {domain.verified !== 1 ? (
                    <DomainVerificationActions
                      appId={app.id}
                      domain={{
                        id: domain.id,
                        host: domain.host,
                        verified: domain.verified === 1,
                        verifyToken: domain.verifyToken,
                        verification: AppService.domainVerificationRecord(domain.host, domain.verifyToken)
                      }}
                      canManualVerify={isSystemAdmin}
                    />
                  ) : null}
                </div>
              ))}
              <AddDomainForm appId={app.id} disabled={!isSystemAdmin} />
            </CardContent>
          </Card>

          <Card id="api-keys" className="scroll-mt-24">
            <CardHeader>
              <CardTitle className="text-base">{t("settings.apiKeysTitle")}</CardTitle>
              <CardDescription>{t("settings.apiKeysDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <ApiKeysPanel appId={app.id} keys={apiKeys} />
            </CardContent>
          </Card>

          <Card id="quota" className="scroll-mt-24">
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
            <Card id="danger" className="scroll-mt-24">
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
      </div>
    </div>
  );
}

function SettingsMetric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-ink-100 bg-white/45 p-4 shadow-xs dark:border-slate-700/70 dark:bg-slate-900/35">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-ink-500 dark:text-slate-400">{label}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-900 text-cream-50 dark:bg-slate-100 dark:text-slate-950">
          {icon}
        </span>
      </div>
      <div className="mt-3 truncate text-lg font-semibold text-ink-900 dark:text-slate-100">{value}</div>
    </div>
  );
}

function SettingsAnchor({ href, icon, label, danger = false }: { href: string; icon: React.ReactNode; label: string; danger?: boolean }) {
  return (
    <a
      href={href}
      className={
        "flex items-center gap-2 rounded-lg px-3 py-2 transition-colors " +
        (danger
          ? "text-danger-700 hover:bg-danger-50 dark:text-danger-200 dark:hover:bg-danger-500/10"
          : "text-ink-600 hover:bg-white/60 hover:text-ink-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-100")
      }
    >
      {icon}
      <span className="truncate">{label}</span>
    </a>
  );
}
