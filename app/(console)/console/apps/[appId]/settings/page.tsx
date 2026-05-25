import { notFound } from "next/navigation";
import { requireConsoleAuth } from "@/shared/iam";
import { prisma } from "@/shared/prisma";
import { AppService } from "@/modules/apps";
import { QuotaService } from "@/shared/quota";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Badge } from "@/ui/primitives";
import {
  BasicInfoForm,
  QuotaForm,
  DangerZone,
  AddDomainForm,
  RemoveDomainButton
} from "@/ui/console/settings-actions";

export default async function SettingsPage({ params }: { params: { appId: string } }) {
  const auth = await requireConsoleAuth();
  const app = await prisma.app.findUnique({
    where: { id: params.appId },
    include: { admins: true, domains: true, owner: true }
  });
  if (!app) notFound();
  if (auth.user.role !== "admin") {
    await AppService.requireOwnerOrAdmin(app.ownerId, app.admins, auth.user.id);
  }
  const isOwner = app.ownerId === auth.user.id;
  const quota = await QuotaService.getOrDefault(app.id);

  return (
    <div className="container-page py-8 space-y-6 max-w-3xl">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">应用设置</h1>
        <p className="text-sm text-ink-500 mt-1">{app.name} · {app.primaryDomain}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">基础信息</CardTitle>
          <CardDescription>名称、描述、主域名。</CardDescription>
        </CardHeader>
        <CardContent>
          <BasicInfoForm
            appId={app.id}
            initial={{
              name: app.name,
              description: app.description,
              primaryDomain: app.primaryDomain
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">附加域名</CardTitle>
          <CardDescription>除主域名外，其它需要访问 SDK 的域名。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {app.domains.length === 0 && (
            <p className="text-sm text-ink-500">尚未添加附加域名。</p>
          )}
          {app.domains.map((d) => (
            <div key={d.id} className="flex items-center justify-between text-sm">
              <span className="font-mono">{d.host}</span>
              <div className="flex items-center gap-2">
                <Badge tone={d.verified ? "success" : "warning"}>
                  {d.verified ? "已校验" : "待校验"}
                </Badge>
                <RemoveDomainButton appId={app.id} domainId={d.id} host={d.host} />
              </div>
            </div>
          ))}
          <AddDomainForm appId={app.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">配额</CardTitle>
          <CardDescription>修改后立即生效，由 trust-chain 拦截。</CardDescription>
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
            <CardTitle className="text-base text-red-700">危险区</CardTitle>
            <CardDescription>仅 owner 可见。请慎重操作。</CardDescription>
          </CardHeader>
          <CardContent>
            <DangerZone appId={app.id} appName={app.name} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
