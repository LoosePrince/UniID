import { requireConsoleAuth } from "@/shared/iam";
import { prisma } from "@/shared/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/primitives";
import { ChangePasswordForm } from "@/ui/console/change-password-form";

export default async function AccountSettingsPage() {
  const auth = await requireConsoleAuth();
  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { id: true, username: true, email: true, displayName: true, role: true, createdAt: true }
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">账号设置</h1>
        <p className="text-sm text-ink-500 mt-1">查看与修改你的账号信息。</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
          <CardDescription>账户的不可变 / 可变信息。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row k="用户名" v={user?.username} />
          <Row k="显示名" v={user?.displayName ?? "—"} />
          <Row k="邮箱" v={user?.email ?? "—"} />
          <Row k="角色" v={user?.role} />
          <Row k="注册时间" v={user ? new Date(user.createdAt * 1000).toLocaleString() : "—"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>修改密码</CardTitle>
          <CardDescription>使用强口令（≥ 8 位）。修改后旧 cookie 不会失效，请前往会话主动登出其它设备。</CardDescription>
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
    <div className="flex items-center justify-between">
      <span className="text-ink-500">{k}</span>
      <span className="font-mono">{v}</span>
    </div>
  );
}
