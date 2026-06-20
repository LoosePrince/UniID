import { notFound } from "next/navigation";
import { normalizeLocale, createI18n } from "@/shared/i18n";
import { requireConsoleAuth } from "@/shared/iam";
import { prisma } from "@/shared/prisma";
import { AppService } from "@/modules/apps";
import { AppDatabaseService } from "@/modules/app-databases";
import { AuditService } from "@/shared/audit";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/primitives";
import { DatabasesWorkspace } from "@/ui/console/database-actions";

export default async function DatabasesPage({ params }: { params: { appId: string } }) {
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

  return (
    <div className="container-page py-8 space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{t("common.databases")}</h1>
        <p className="text-sm text-ink-500 mt-1">{t("appDatabases.description")}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Independent SQLite</CardTitle>
          <CardDescription>
            默认 Data API 仍写入 UniID 主库并受 1000 条 / 5MB 小额上限保护；迁移后的 dataType 会绑定到独立 SQL 库并停止主库写入。
          </CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}
