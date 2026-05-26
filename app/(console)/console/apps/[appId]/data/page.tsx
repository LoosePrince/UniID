import { notFound } from "next/navigation";
import Link from "next/link";
import { normalizeLocale, createI18n } from "@/shared/i18n";
import { requireConsoleAuth } from "@/shared/iam";
import { prisma } from "@/shared/prisma";
import { AppService } from "@/modules/apps";
import { SchemaService } from "@/modules/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge, Button } from "@/ui/primitives";
import { Plus } from "lucide-react";

export default async function DataIndexPage({ params }: { params: { appId: string } }) {
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

  const [schemas, recordStats] = await Promise.all([
    SchemaService.listForApp(app.id),
    prisma.record.groupBy({
      by: ["dataType"],
      where: { appId: app.id, deletedAt: null },
      _count: { _all: true },
      _max: { updatedAt: true }
    })
  ]);
  const statsByType = new Map(recordStats.map((item) => [item.dataType, item]));

  return (
    <div className="container-page py-8 space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("appData.title")}</h1>
          <p className="text-sm text-ink-500 mt-1">{t("appData.description")}</p>
        </div>
        <Button asChild>
          <Link href={`/console/apps/${app.id}/schemas`}><Plus /> {t("data.manageSchemas")}</Link>
        </Button>
      </header>

      {schemas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm font-medium text-ink-700">{t("data.noDataTypesTitle")}</p>
            <p className="mt-1 text-xs text-ink-500">{t("data.noDataTypesDescription")}</p>
            <Button asChild variant="outline" className="mt-4">
              <Link href={`/console/apps/${app.id}/schemas`}><Plus /> {t("data.createFirstSchema")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {schemas.map((schema) => {
            const version = schema.versions[0];
            const stats = statsByType.get(schema.dataType);
            const count = stats?._count._all ?? 0;
            const updatedAt = stats?._max.updatedAt;
            return (
              <Link key={schema.id} href={`/console/apps/${app.id}/data/${schema.dataType}`}>
                <Card className="h-full hover:border-ink-300 hover:shadow-sm transition-[border,box-shadow]">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="font-mono text-sm truncate">{schema.dataType}</CardTitle>
                      {version && <Badge tone={version.isActive ? "success" : "neutral"}>v{version.version}</Badge>}
                    </div>
                    <CardDescription className="line-clamp-2">
                      {schema.description ?? t("data.noDescription")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3 text-xs text-ink-500">
                    <div>
                      <p className="text-2xs uppercase tracking-wide text-ink-400">{t("data.recordsLabel")}</p>
                      <p className="mt-1 text-sm font-medium text-ink-900">{formatNumber(count)}</p>
                    </div>
                    <div>
                      <p className="text-2xs uppercase tracking-wide text-ink-400">{t("data.lastUpdate")}</p>
                      <p className="mt-1 truncate text-ink-700">
                        {updatedAt ? formatDateTime(updatedAt) : "—"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
