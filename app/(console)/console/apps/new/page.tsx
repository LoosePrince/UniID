import { ArrowLeft, BadgeCheck, Globe2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { requireConsoleAuth } from "@/shared/iam";
import { prisma } from "@/shared/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from "@/ui/primitives";
import { CreateAppForm } from "@/ui/console/create-app-form";

export default async function NewAppPage() {
  const auth = await requireConsoleAuth();
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { username: "asc" },
    select: { id: true, username: true, displayName: true, email: true }
  });
  const canCreate = auth.user.role === "admin";

  return (
    <div className="container-page py-8">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm">
          <Link href="/console/apps">
            <ArrowLeft /> 返回应用列表
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">新建应用</CardTitle>
            <CardDescription>
              仅 UniID 系统管理员可创建应用，并可在创建时指定 owner 与管理员。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canCreate ? (
              <CreateAppForm users={users} currentUserId={auth.user.id} />
            ) : (
              <div className="rounded-xl border border-sand-200 bg-cream-50 px-4 py-3 text-sm text-ink-600">
                当前账号没有创建应用权限。请联系 UniID 系统管理员创建，并将你设为 owner 或管理员。
              </div>
            )}
          </CardContent>
        </Card>

        <aside className="space-y-3">
          <InfoCard
            icon={Globe2}
            title="先绑定主域名"
            text="主域名会成为 SDK 请求来源校验的默认边界。附加域名只能由系统管理员继续添加。"
          />
          <InfoCard
            icon={ShieldCheck}
            title="默认最小权限"
            text="创建时可指定应用 owner，并可同时分配多个应用管理员。"
          />
          <InfoCard
            icon={BadgeCheck}
            title="配额自动初始化"
            text="创建时会写入默认 RPS、API 调用、存储、出站和函数调用配额。"
          />
        </aside>
      </div>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  text
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <Card className="bg-white/70">
      <CardContent className="flex gap-3 p-4">
        <div className="mt-0.5 rounded-md bg-accent-50 p-2 text-accent-700">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-medium text-ink-900">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-ink-500">{text}</p>
        </div>
      </CardContent>
    </Card>
  );
}