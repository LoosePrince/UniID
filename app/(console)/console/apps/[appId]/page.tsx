import { notFound } from "next/navigation";
import { requireConsoleAuth } from "@/shared/iam";
import { AppService } from "@/modules/apps";
import { prisma } from "@/shared/prisma";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/primitives";

export default async function AppOverviewPage({ params }: { params: { appId: string } }) {
  const auth = await requireConsoleAuth();
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
        <Card>
          <CardContent className="p-4">
            <p className="text-2xs uppercase tracking-wider text-ink-400">记录</p>
            <p className="mt-1 text-2xl font-semibold">{recordsCount.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xs uppercase tracking-wider text-ink-400">文件</p>
            <p className="mt-1 text-2xl font-semibold">{filesCount.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xs uppercase tracking-wider text-ink-400">活跃会话</p>
            <p className="mt-1 text-2xl font-semibold">{sessionsCount.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xs uppercase tracking-wider text-ink-400">Schemas</p>
            <p className="mt-1 text-2xl font-semibold">{schemasCount.toLocaleString()}</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardHeader>
            <CardTitle>域名</CardTitle>
            <CardDescription>仅以下域名可访问该应用的 UniID API。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-mono">{app.primaryDomain}</span>
              <Badge tone="solid">主域名</Badge>
            </div>
            {app.domains.map((d) => (
              <div key={d.id} className="flex items-center justify-between">
                <span className="font-mono">{d.host}</span>
                <Badge tone={d.verified ? "success" : "warning"}>
                  {d.verified ? "已校验" : "待校验"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>配额</CardTitle>
            <CardDescription>限制超出后请求会被节流。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row k="RPS" v={app.quota?.rpsLimit ?? "—"} />
            <Row k="每日 API 调用" v={app.quota?.dailyApiCalls?.toLocaleString() ?? "—"} />
            <Row k="存储 (字节)" v={app.quota?.monthlyStorageBytes?.toLocaleString() ?? "—"} />
            <Row k="出站 (字节)" v={app.quota?.monthlyEgressBytes?.toLocaleString() ?? "—"} />
            <Row k="函数 / 日" v={app.quota?.fnInvocationsDaily?.toLocaleString() ?? "—"} />
          </CardContent>
        </Card>
      </section>
    </div>
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
