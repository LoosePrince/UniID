/**
 * 系统管理 · 用户
 *
 * 显示所有用户，支持搜索、状态筛选、角色筛选、禁用 / 启用 / 改角色 / 重置密码。
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { requireSystemAdmin } from "@/shared/iam";
import { AdminService } from "@/modules/admin";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Select } from "@/ui/primitives";
import { UserActions } from "@/ui/console/admin-user-actions";

export const dynamic = "force-dynamic";

const pageSize = 25;

type SearchParams = {
  q?: string;
  role?: string;
  status?: string;
  page?: string;
};

export default async function AdminUsersPage({ searchParams }: { searchParams?: SearchParams }) {
  try {
    await requireSystemAdmin();
  } catch {
    redirect("/console");
  }

  const q = searchParams?.q?.trim() ?? "";
  const role = searchParams?.role === "admin" || searchParams?.role === "user" ? searchParams.role : "all";
  const status = searchParams?.status === "active" || searchParams?.status === "disabled" ? searchParams.status : "all";
  const page = Math.max(1, Number(searchParams?.page ?? 1) || 1);

  const allUsers = await AdminService.listUsers({ search: q || undefined, limit: 200 });
  const filtered = allUsers.filter((user) => {
    const roleMatched = role === "all" || user.role === role;
    const statusMatched = status === "all" || (status === "disabled" ? user.deletedAt !== null : user.deletedAt === null);
    return roleMatched && statusMatched;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const users = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const makeHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (role !== "all") params.set("role", role);
    if (status !== "all") params.set("status", status);
    params.set("page", String(nextPage));
    return `/console/admin/users?${params.toString()}`;
  };

  return (
    <div className="container-page space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">用户管理</h1>
        <p className="mt-1 text-sm text-ink-500">共 {filtered.length} 个匹配用户，当前显示 {users.length} 个。</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>筛选</CardTitle>
          <CardDescription>搜索、角色、状态筛选在服务端渲染后生效。</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_160px_160px_auto]" action="/console/admin/users">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <Input name="q" defaultValue={q} className="pl-9" placeholder="搜索用户名或邮箱" />
            </div>
            <Select
              name="role"
              defaultValue={role}
              aria-label="角色筛选"
              options={[
                { value: "all", label: "全部角色" },
                { value: "admin", label: "admin" },
                { value: "user", label: "user" }
              ]}
            />
            <Select
              name="status"
              defaultValue={status}
              aria-label="状态筛选"
              options={[
                { value: "all", label: "全部状态" },
                { value: "active", label: "活跃" },
                { value: "disabled", label: "已禁用" }
              ]}
            />
            <Button type="submit">筛选</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>全部用户</CardTitle>
          <CardDescription>第 {safePage} / {totalPages} 页</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[820px] text-sm">
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
                    <Badge tone={u.role === "admin" ? "accent" : "neutral"}>{u.role === "admin" ? "admin" : "user"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {u.deletedAt ? <Badge tone="danger">已禁用</Badge> : <Badge tone="success">活跃</Badge>}
                  </td>
                  <td className="px-4 py-3 text-ink-700">{u._count.appSessions}</td>
                  <td className="px-4 py-3 text-ink-700">{u._count.recordsOwned} / {u._count.filesOwned}</td>
                  <td className="px-4 py-3 text-right">
                    <UserActions
                      user={{
                        id: u.id,
                        username: u.username,
                        email: u.email,
                        displayName: u.displayName,
                        locale: u.locale,
                        role: u.role as "user" | "admin",
                        disabled: u.deletedAt !== null
                      }}
                    />
                  </td>
                </tr>
              ))}
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-ink-400">暂无匹配用户</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button asChild variant="outline" size="sm" disabled={safePage <= 1}>
          <Link href={makeHref(Math.max(1, safePage - 1))}>上一页</Link>
        </Button>
        <Button asChild variant="outline" size="sm" disabled={safePage >= totalPages}>
          <Link href={makeHref(Math.min(totalPages, safePage + 1))}>下一页</Link>
        </Button>
      </div>
    </div>
  );
}
