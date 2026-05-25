import { ArrowLeft, BadgeCheck, Globe2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { requireConsoleAuth } from "@/shared/iam";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from "@/ui/primitives";
import { CreateAppForm } from "@/ui/console/create-app-form";

export default async function NewAppPage() {
  await requireConsoleAuth();

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
              创建后即可配置 Schema、文件、函数、Webhook 与 SDK 授权。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateAppForm />
          </CardContent>
        </Card>

        <aside className="space-y-3">
          <InfoCard
            icon={Globe2}
            title="先绑定主域名"
            text="主域名会成为 SDK 请求来源校验的默认边界。附加域名可在设置页继续添加。"
          />
          <InfoCard
            icon={ShieldCheck}
            title="默认最小权限"
            text="新应用只对创建者开放管理权限，后续可在成员页添加管理员。"
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