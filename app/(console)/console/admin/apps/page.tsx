/**
 * 系统管理 · 全部应用（跨用户）
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { Search } from "lucide-react";
import { normalizeLocale, createI18n } from "@/shared/i18n";
import { requireSystemAdmin } from "@/shared/iam";
import { AdminService } from "@/modules/admin";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Select } from "@/ui/primitives";
import { AppStatusActions } from "@/ui/console/admin-app-actions";

export const dynamic = "force-dynamic";

const statusTone = {
  active: "success",
  suspended: "warning",
  archived: "neutral"
} as const;

const pageSize = 25;

type SearchParams = {
  q?: string;
  status?: string;
  page?: string;
};

export default async function AdminAppsPage({ searchParams }: { searchParams?: SearchParams }) {
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

  const q = searchParams?.q?.trim().toLowerCase() ?? "";
  const status = ["active", "suspended", "archived"].includes(searchParams?.status ?? "") ? searchParams?.status : "all";
  const page = Math.max(1, Number(searchParams?.page ?? 1) || 1);

  const allApps = await AdminService.listAllApps(500);
  const filtered = allApps.filter((app) => {
    const qMatched = !q || app.name.toLowerCase().includes(q) || app.primaryDomain.toLowerCase().includes(q) || app.owner.username.toLowerCase().includes(q);
    const statusMatched = status === "all" || app.status === status;
    return qMatched && statusMatched;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const apps = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const makeHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status !== "all" && status) params.set("status", status);
    params.set("page", String(nextPage));
    return `/console/admin/apps?${params.toString()}`;
  };

  return (
    <div className="container-page space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("admin.apps.title")}</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-slate-400">
          {t("admin.apps.summary", { total: formatNumber(filtered.length), shown: formatNumber(apps.length) })}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.filterTitle")}</CardTitle>
          <CardDescription>{t("admin.filterAppsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_auto]" action="/console/admin/apps">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400 dark:text-slate-500" />
              <Input name="q" defaultValue={q} className="pl-9" placeholder={t("admin.searchApps")} />
            </div>
            <Select
              name="status"
              defaultValue={status ?? "all"}
              aria-label={t("admin.statusFilter")}
              options={[
                { value: "all", label: t("admin.statusAll") },
                { value: "active", label: "active" },
                { value: "suspended", label: "suspended" },
                { value: "archived", label: "archived" }
              ]}
            />
            <Button type="submit">{t("admin.filterSubmit")}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.appList")}</CardTitle>
          <CardDescription>{t("admin.pageOf", { page: safePage, total: totalPages })}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="border-b border-sand-200 bg-cream-50 dark:border-slate-700/70 dark:bg-slate-900/70">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-ink-500 dark:text-slate-300">{t("admin.col.nameDomain")}</th>
                <th className="px-4 py-2 text-left font-medium text-ink-500 dark:text-slate-300">{t("admin.col.owner")}</th>
                <th className="px-4 py-2 text-left font-medium text-ink-500 dark:text-slate-300">{t("admin.col.status")}</th>
                <th className="px-4 py-2 text-left font-medium text-ink-500 dark:text-slate-300">{t("admin.col.auth")}</th>
                <th className="px-4 py-2 text-left font-medium text-ink-500 dark:text-slate-300">{t("admin.col.stats")}</th>
                <th className="px-4 py-2 text-right font-medium text-ink-500 dark:text-slate-300">{t("admin.col.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id} className="border-b border-sand-200 bg-white/30 transition-colors last:border-b-0 hover:bg-cream-50 dark:border-slate-700/70 dark:bg-slate-950/10 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3">
                    <Link href={`/console/apps/${a.id}`} className="font-medium text-ink-900 hover:underline dark:text-slate-100 dark:hover:text-slate-50">
                      {a.name}
                    </Link>
                    <div className="font-mono text-xs text-ink-400 dark:text-slate-500">{a.primaryDomain}</div>
                  </td>
                  <td className="px-4 py-3 text-ink-700 dark:text-slate-300">@{a.owner.username}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone[a.status as keyof typeof statusTone] ?? "neutral"}>{a.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-ink-700 dark:text-slate-300">{a._count.authorizations}</td>
                  <td className="px-4 py-3 text-ink-700 dark:text-slate-300">{a._count.records} / {a._count.files} / {a._count.appSessions}</td>
                  <td className="px-4 py-3 text-right">
                    <AppStatusActions app={{ id: a.id, name: a.name, status: a.status as "active" | "suspended" | "archived" }} />
                  </td>
                </tr>
              ))}
              {apps.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-ink-400 dark:text-slate-500">{t("admin.noMatchApps")}</td>
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
