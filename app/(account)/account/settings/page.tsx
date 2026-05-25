import { requireConsoleAuth } from "@/shared/iam";
import { prisma } from "@/shared/prisma";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/primitives";
import { AccountProfileForm } from "@/ui/console/account-profile-form";
import { ChangePasswordForm } from "@/ui/console/change-password-form";

export default async function AccountSettingsPage() {
  const auth = await requireConsoleAuth();
  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: {
      id: true,
      username: true,
      email: true,
      displayName: true,
      role: true,
      locale: true,
      createdAt: true,
      updatedAt: true
    }
  });

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">账号设置</h1>
        <p className="mt-1 text-sm text-ink-500">查看与修改你的账号信息。</p>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>账号概览</CardTitle>
              <CardDescription>用户名和角色由系统管理，资料项可在下方编辑。</CardDescription>
            </div>
            <Badge tone={user?.role === "admin" ? "accent" : "neutral"}>{user?.role ?? "user"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row k="用户 ID" v={user?.id ?? "—"} />
          <Row k="用户名" v={user?.username ?? "—"} />
          <Row k="注册时间" v={user ? new Date(user.createdAt * 1000).toLocaleString() : "—"} />
          <Row k="最近更新" v={user ? new Date(user.updatedAt * 1000).toLocaleString() : "—"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>个人资料</CardTitle>
          <CardDescription>开放已有账号字段，避免做无后端支撑的伪功能。</CardDescription>
        </CardHeader>
        <CardContent>
          <AccountProfileForm
            initial={{
              displayName: user?.displayName ?? user?.username ?? "",
              email: user?.email ?? "",
              locale: user?.locale ?? "zh-CN"
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>修改密码</CardTitle>
          <CardDescription>使用强口令（≥ 8 位）。如需踢出其他设备，请前往会话页撤销。</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-ink-100 bg-cream-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-ink-500">{k}</span>
      <span className="break-all font-mono text-xs text-ink-900">{v}</span>
    </div>
  );
}
