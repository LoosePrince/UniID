import Link from "next/link";
import { ArrowUpRight, Database, Files, Globe, KeyRound } from "lucide-react";
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
        <h1 className="text-2xl font-semibold tracking-tight">概览</h1>
        <p className="text-sm text-ink-500 mt-1">欢迎回来，{auth.user.username}。</p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="应用" value={stats.appsCount} icon={Database} />
        <StatCard label="活跃会话" value={stats.sessionsCount} icon={KeyRound} />
        <StatCard label="文件" value={stats.filesCount} icon={Files} />
        {auth.user.role === "admin" && (
          <StatCard label="用户" value={stats.usersCount} icon={Globe} />
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-md font-semibold tracking-tight">最近的应用</h2>
          <Link href="/console/apps" className="text-xs text-accent-600 hover:underline inline-flex items-center gap-1">
            查看全部 <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        {apps.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-ink-500">
              你还没有应用。<Link href="/console/apps?new=1" className="text-accent-600 hover:underline">创建第一个 →</Link>
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
                  <span>{a._count.records} 条记录</span>
                  <span>{a._count.files} 个文件</span>
                  <span>{a._count.appSessions} 会话</span>
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
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-2xs uppercase tracking-wider font-medium text-ink-400">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value.toLocaleString()}</p>
        </div>
        <Icon className="h-5 w-5 text-ink-300" />
      </CardContent>
    </Card>
  );
}
