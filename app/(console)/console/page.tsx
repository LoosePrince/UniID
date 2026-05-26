import Link from "next/link";
import { ArrowUpRight, Database, Files, Globe, KeyRound } from "lucide-react";
import { normalizeLocale, createI18n } from "@/shared/i18n";
import { prisma } from "@/shared/prisma";
import { requireConsoleAuth } from "@/shared/iam";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/primitives";

async function getStats(userId: string, isAdmin: boolean) {
  if (isAdmin) {
    const [appsCount, usersCount, sessionsCount, filesCount] = await Promise.all([
      prisma.app.count(),
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.appSession.count({ where: { revokedAt: null } }),
      prisma.fileObject.count({ where: { deletedAt: null } })
    ]);
    return { appsCount, usersCount, sessionsCount, filesCount };
  }
  const [appsCount, sessionsCount, filesCount] = await Promise.all([
    prisma.app.count({
      where: { OR: [{ ownerId: userId }, { admins: { some: { userId } } }] }
    }),
    prisma.appSession.count({ where: { userId, revokedAt: null } }),
    prisma.fileObject.count({ where: { ownerId: userId, deletedAt: null } })
  ]);
  return { appsCount, usersCount: 1, sessionsCount, filesCount };
}

export default async function ConsoleOverviewPage() {
  const auth = await requireConsoleAuth();
  const { t, formatNumber } = createI18n(normalizeLocale(auth.user.locale));
  const stats = await getStats(auth.user.id, auth.user.role === "admin");
  const apps = await prisma.app.findMany({
    where: auth.user.role === "admin"
      ? {}
      : { OR: [{ ownerId: auth.user.id }, { admins: { some: { userId: auth.user.id } } }] },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: {
      id: true,
      name: true,
      primaryDomain: true,
      description: true,
      _count: { select: { records: true, files: true, appSessions: true } }
    }
  });

  return (
    <div className="container-page py-8 space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("console.overview.title")}</h1>
        <p className="text-sm text-ink-500 mt-1">{t("console.overview.welcome", { username: auth.user.username })}</p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={t("common.apps")} value={formatNumber(stats.appsCount)} icon={Database} />
        <StatCard label={t("console.overview.sessionsLabel")} value={formatNumber(stats.sessionsCount)} icon={KeyRound} />
        <StatCard label={t("common.files")} value={formatNumber(stats.filesCount)} icon={Files} />
        {auth.user.role === "admin" && (
          <StatCard label={t("common.users")} value={formatNumber(stats.usersCount)} icon={Globe} />
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-md font-semibold tracking-tight">{t("console.overview.recentApps")}</h2>
          <Link href="/console/apps" className="text-xs text-accent-600 hover:underline inline-flex items-center gap-1">
            {t("console.overview.viewAll")} <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        {apps.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-ink-500">
              {t("console.overview.emptyApps")}<Link href="/console/apps/new" className="text-accent-600 hover:underline">{t("console.overview.createFirstApp")}</Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {apps.map((a) => (
              <Card key={a.id} className="hover:border-ink-300 transition-colors">
                <CardHeader>
                  <CardTitle>
                    <Link href={`/console/apps/${a.id}`} className="hover:underline">
                      {a.name}
                    </Link>
                  </CardTitle>
                  <CardDescription className="font-mono">{a.primaryDomain}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-4 text-xs text-ink-500">
                  <span>{t("console.overview.records", { count: formatNumber(a._count.records) })}</span>
                  <span>{t("console.overview.files", { count: formatNumber(a._count.files) })}</span>
                  <span>{t("console.overview.sessions", { count: formatNumber(a._count.appSessions) })}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-2xs uppercase tracking-wider font-medium text-ink-400">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
        </div>
        <Icon className="h-5 w-5 text-ink-300" />
      </CardContent>
    </Card>
  );
}
