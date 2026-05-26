/**
 * 系统管理 · 用户
 *
 * 显示所有用户，支持搜索、状态筛选、角色筛选、禁用 / 启用 / 改角色 / 重置密码。
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { normalizeLocale, createI18n } from "@/shared/i18n";
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
  let t: ReturnType<typeof createI18n>["t"];
  let formatNumber: ReturnType<typeof createI18n>["formatNumber"];
  try {
    const auth = await requireSystemAdmin();
    const i18n = createI18n(normalizeLocale(auth.user.locale));
    t = i18n.t;
    formatNumber = i18n.formatNumber;
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
        <h1 className="text-2xl font-semibold tracking-tight">{t("admin.users.title")}</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-slate-400">
          {t("admin.users.summary", { total: formatNumber(filtered.length), shown: formatNumber(users.length) })}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.filterTitle")}</CardTitle>
          <CardDescription>{t("admin.filterUsersDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_160px_160px_auto]" action="/console/admin/users">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400 dark:text-slate-500" />
              <Input name="q" defaultValue={q} className="pl-9" placeholder={t("admin.searchUsers")} />
            </div>
            <Select
              name="role"
              defaultValue={role}
              aria-label={t("admin.roleFilter")}
              options={[
                { value: "all", label: t("admin.roleAll") },
                { value: "admin", label: "admin" },
                { value: "user", label: "user" }
              ]}
            />
            <Select
              name="status"
              defaultValue={status}
              aria-label={t("admin.statusFilter")}
              options={[
                { value: "all", label: t("admin.statusAll") },
                { value: "active", label: t("admin.statusActive") },
                { value: "disabled", label: t("admin.statusDisabled") }
              ]}
            />
            <Button type="submit">{t("admin.filterSubmit")}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.userList")}</CardTitle>
          <CardDescription>{t("admin.pageOf", { page: safePage, total: totalPages })}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-sand-200 bg-cream-50 dark:border-slate-700/70 dark:bg-slate-900/70">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-ink-500 dark:text-slate-300">{t("admin.col.username")}</th>
                <th className="px-4 py-2 text-left font-medium text-ink-500 dark:text-slate-300">{t("admin.col.email")}</th>
                <th className="px-4 py-2 text-left font-medium text-ink-500 dark:text-slate-300">{t("admin.col.role")}</th>
                <th className="px-4 py-2 text-left font-medium text-ink-500 dark:text-slate-300">{t("admin.col.status")}</th>
                <th className="px-4 py-2 text-left font-medium text-ink-500 dark:text-slate-300">{t("admin.col.sessions")}</th>
                <th className="px-4 py-2 text-left font-medium text-ink-500 dark:text-slate-300">{t("admin.col.userStats")}</th>
                <th className="px-4 py-2 text-right font-medium text-ink-500 dark:text-slate-300">{t("admin.col.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-sand-200 bg-white/30 transition-colors last:border-b-0 hover:bg-cream-50 dark:border-slate-700/70 dark:bg-slate-950/10 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink-900 dark:text-slate-100">{u.displayName ?? u.username}</div>
                    <div className="text-xs text-ink-400 dark:text-slate-500">@{u.username}</div>
                  </td>
                  <td className="px-4 py-3 text-ink-700 dark:text-slate-300">{u.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={u.role === "admin" ? "accent" : "neutral"}>{u.role === "admin" ? "admin" : "user"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {u.deletedAt ? <Badge tone="danger">{t("admin.statusDisabled")}</Badge> : <Badge tone="success">{t("admin.statusActive")}</Badge>}
                  </td>
                  <td className="px-4 py-3 text-ink-700 dark:text-slate-300">{u._count.appSessions}</td>
                  <td className="px-4 py-3 text-ink-700 dark:text-slate-300">{u._count.recordsOwned} / {u._count.filesOwned}</td>
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
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-ink-400 dark:text-slate-500">{t("admin.noMatchUsers")}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button asChild variant="outline" size="sm" disabled={safePage <= 1}>
          <Link href={makeHref(Math.max(1, safePage - 1))}>{t("admin.prevPage")}</Link>
        </Button>
        <Button asChild variant="outline" size="sm" disabled={safePage >= totalPages}>
          <Link href={makeHref(Math.min(totalPages, safePage + 1))}>{t("admin.nextPage")}</Link>
        </Button>
      </div>
    </div>
  );
}
