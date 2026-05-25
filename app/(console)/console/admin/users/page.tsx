/**
 * 系统管理 · 用户
 *
 * 显示所有用户，支持禁用 / 启用 / 改角色 / 重置密码（弹窗确认）。
 */
import { redirect } from "next/navigation";
import { requireSystemAdmin } from "@/shared/iam";
import { AdminService } from "@/modules/admin";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/ui/primitives";
import { UserActions } from "@/ui/console/admin-user-actions";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  try {
    await requireSystemAdmin();
  } catch {
    redirect("/console");
  }

  const users = await AdminService.listUsers({ limit: 100 });

  return (
    <div className="container-page py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">用户管理</h1>
        <p className="mt-1 text-sm text-ink-500">{users.length} 个用户</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>全部用户</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-sand-200 bg-cream-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-ink-500">用户名</th>
                <th className="px-4 py-2 text-left font-medium text-ink-500">邮箱</th>
                <th className="px-4 py-2 text-left font-medium text-ink-500">角色</th>
                <th className="px-4 py-2 text-left font-medium text-ink-500">状态</th>
                <th className="px-4 py-2 text-left font-medium text-ink-500">会话</th>
                <th className="px-4 py-2 text-left font-medium text-ink-500">记录/文件</th>
                <th className="px-4 py-2 text-right font-medium text-ink-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-sand-200 last:border-b-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink-900">{u.displayName ?? u.username}</div>
                    <div className="text-xs text-ink-400">@{u.username}</div>
                  </td>
                  <td className="px-4 py-3 text-ink-700">{u.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    {u.role === "admin" ? (
                      <Badge tone="accent">admin</Badge>
                    ) : (
                      <Badge tone="neutral">user</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {u.deletedAt ? (
                      <Badge tone="danger">已禁用</Badge>
                    ) : (
                      <Badge tone="success">活跃</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-700">{u._count.appSessions}</td>
                  <td className="px-4 py-3 text-ink-700">
                    {u._count.recordsOwned} / {u._count.filesOwned}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <UserActions
                      user={{
                        id: u.id,
                        username: u.username,
                        role: u.role as "user" | "admin",
                        disabled: u.deletedAt !== null
                      }}
                    />
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-ink-400">
                    暂无用户
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
