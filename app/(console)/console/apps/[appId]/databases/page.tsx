import { notFound } from "next/navigation";
import { DatabaseZap, HardDrive, KeyRound, UploadCloud } from "lucide-react";
import { normalizeLocale, createI18n } from "@/shared/i18n";
import { requireConsoleAuth } from "@/shared/iam";
import { prisma } from "@/shared/prisma";
import { AppService } from "@/modules/apps";
import { AppDatabaseService } from "@/modules/app-databases";
import { AuditService } from "@/shared/audit";
import { Badge, Callout, CalloutDescription, CalloutTitle } from "@/ui/primitives";
import { DatabasesWorkspace } from "@/ui/console/database-actions";

export default async function DatabasesPage({ params }: { params: { appId: string } }) {
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

  const [databases, schemas, bindings, audits] = await Promise.all([
    AppDatabaseService.list(app.id),
    prisma.dataSchema.findMany({
      where: { appId: app.id },
      include: { versions: { where: { isActive: 1 }, take: 1 } },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.dataStorageBinding.findMany({
      where: { appId: app.id },
      orderBy: { updatedAt: "desc" }
    }),
    AuditService.list({
      appId: app.id,
      limit: 20,
      query: "database"
    })
  ]);
  const activeDatabases = databases.filter((database) => database.status === "active" && database.deletedAt == null).length;
  const migratedDataTypes = bindings.filter((binding) => binding.storageKind === "external_sql" && binding.databaseId).length;
  const activeKeys = databases.reduce(
    (total, database) => total + (database.keys?.filter((key) => key.revokedAt == null).length ?? 0),
    0
  );

  return (
    <div className="container-page py-8 space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">{t("common.databases")}</h1>
          <p className="mt-1 truncate text-sm text-ink-500 dark:text-slate-400">
            {app.name} · {app.primaryDomain}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={app.status === "active" ? "success" : "warning"}>{app.status}</Badge>
          <Badge tone="neutral">{t("appDatabases.independentSQLite")}</Badge>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-4">
        <DatabaseMetric label={t("appDatabases.metric.total")} value={formatNumber(databases.length)} icon={<HardDrive className="h-4 w-4" />} />
        <DatabaseMetric label={t("appDatabases.metric.active")} value={formatNumber(activeDatabases)} icon={<DatabaseZap className="h-4 w-4" />} />
        <DatabaseMetric label={t("appDatabases.metric.keys")} value={formatNumber(activeKeys)} icon={<KeyRound className="h-4 w-4" />} />
        <DatabaseMetric label={t("appDatabases.metric.migrated")} value={formatNumber(migratedDataTypes)} icon={<UploadCloud className="h-4 w-4" />} />
      </div>

      <Callout tone="info">
        <CalloutTitle>{t("appDatabases.routingTitle")}</CalloutTitle>
        <CalloutDescription>{t("appDatabases.routingDescription")}</CalloutDescription>
      </Callout>

      <DatabasesWorkspace
        appId={app.id}
        initialDatabases={databases}
        schemas={schemas.map((schema) => ({
          id: schema.id,
          dataType: schema.dataType,
          description: schema.description,
          updatedAt: schema.updatedAt,
          activeVersion: schema.versions[0]?.version ?? null
        }))}
        bindings={bindings.map((binding) => ({
          id: binding.id,
          dataType: binding.dataType,
          storageKind: binding.storageKind,
          databaseId: binding.databaseId,
          tableName: binding.tableName,
          migratedAt: binding.migratedAt
        }))}
        audits={audits.map((log) => ({
          id: log.id,
          action: log.action,
          resourceType: log.resourceType,
          resourceId: log.resourceId,
          userId: log.userId,
          createdAtLabel: formatDateTime(log.createdAt),
          after: log.after
        }))}
      />
    </div>
  );
}

function DatabaseMetric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-ink-100 bg-white/45 p-4 shadow-xs dark:border-slate-700/70 dark:bg-slate-900/35">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-ink-500 dark:text-slate-400">{label}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-900 text-cream-50 dark:bg-slate-100 dark:text-slate-950">
          {icon}
        </span>
      </div>
      <div className="mt-3 truncate text-lg font-semibold tabular-nums text-ink-900 dark:text-slate-100">{value}</div>
    </div>
  );
}
