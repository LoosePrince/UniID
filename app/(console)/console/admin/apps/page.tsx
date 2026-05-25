/**
 * 系统管理 · 全部应用（跨用户）
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSystemAdmin } from "@/shared/iam";
import { AdminService } from "@/modules/admin";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/ui/primitives";
import { AppStatusActions } from "@/ui/console/admin-app-actions";

export const dynamic = "force-dynamic";

const statusTone = {
  active: "success",
  suspended: "warning",
  archived: "neutral"
} as const;

export default async function AdminAppsPage() {
  try {
    await requireSystemAdmin();
  } catch {
    redirect("/console");
  }

  const apps = await AdminService.listAllApps(200);

  return (
    <div className="container-page py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">全部应用</h1>
        <p className="mt-1 text-sm text-ink-500">{apps.length} 个应用</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>应用列表</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-sand-200 bg-cream-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-ink-500">名称 / 域名</th>
                <th className="px-4 py-2 text-left font-medium text-ink-500">所有者</th>
                <th className="px-4 py-2 text-left font-medium text-ink-500">状态</th>
                <th className="px-4 py-2 text-left font-medium text-ink-500">授权</th>
                <th className="px-4 py-2 text-left font-medium text-ink-500">记录/文件/会话</th>
                <th className="px-4 py-2 text-right font-medium text-ink-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id} className="border-b border-sand-200 last:border-b-0">
                  <td className="px-4 py-3">
                    <Link href={`/console/apps/${a.id}`} className="font-medium text-ink-900 hover:underline">
                      {a.name}
                    </Link>
                    <div className="text-xs font-mono text-ink-400">{a.primaryDomain}</div>
                  </td>
                  <td className="px-4 py-3 text-ink-700">@{a.owner.username}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone[a.status as keyof typeof statusTone] ?? "neutral"}>
                      {a.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-ink-700">{a._count.authorizations}</td>
                  <td className="px-4 py-3 text-ink-700">
                    {a._count.records} / {a._count.files} / {a._count.appSessions}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <AppStatusActions
                      app={{ id: a.id, name: a.name, status: a.status as "active" | "suspended" | "archived" }}
                    />
                  </td>
                </tr>
              ))}
              {apps.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-ink-400">
                    暂无应用
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
