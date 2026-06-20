import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, Clock3, Filter, Network, Search, UserRound } from "lucide-react";
import { normalizeLocale, createI18n } from "@/shared/i18n";
import { requireConsoleAuth } from "@/shared/iam";
import { prisma } from "@/shared/prisma";
import { AppService } from "@/modules/apps";
import { AuditService } from "@/shared/audit";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "@/ui/primitives";

interface PageProps {
  params: { appId: string };
  searchParams?: Record<string, string | string[] | undefined>;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function toEpoch(value: string | undefined, endOfDay = false): number | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date.setUTCHours(23, 59, 59, 999);
  }
  return Math.floor(date.getTime() / 1000);
}

function preview(value: string | null | undefined, limit = 900) {
  if (!value) return "";
  try {
    return JSON.stringify(JSON.parse(value), null, 2).slice(0, limit);
  } catch {
    return value.slice(0, limit);
  }
}

function filterHref(appId: string, patch: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(patch)) {
    if (value) params.set(key, value);
  }
  const suffix = params.toString();
  return `/console/apps/${appId}/audit${suffix ? `?${suffix}` : ""}`;
}

function actionTone(action: string): "success" | "warning" | "danger" | "neutral" | "accent" {
  if (/\b(delete|revoke|disable|destroy|abort)\b/i.test(action)) return "danger";
  if (/\b(create|upload|enable|verify|restore)\b/i.test(action)) return "success";
  if (/\b(update|rotate|patch|migrate)\b/i.test(action)) return "warning";
  if (/\b(login|auth|session)\b/i.test(action)) return "accent";
  return "neutral";
}

export default async function AuditPage({ params, searchParams }: PageProps) {
  const auth = await requireConsoleAuth();
  const { t, formatDateTime, formatNumber } = createI18n(normalizeLocale(auth.user.locale));
  const app = await prisma.app.findUnique({
    where: { id: params.appId },
    include: { admins: true }
  });
  if (!app) notFound();
  if (auth.user.role !== "admin") {
    await AppService.requireOwnerOrAdmin(app.ownerId, app.admins, auth.user.id);
  }

  const filters = {
    q: first(searchParams?.q) ?? "",
    action: first(searchParams?.action) ?? "",
    resourceType: first(searchParams?.resourceType) ?? "",
    resourceId: first(searchParams?.resourceId) ?? "",
    userId: first(searchParams?.userId) ?? "",
    from: first(searchParams?.from) ?? "",
    to: first(searchParams?.to) ?? "",
    cursor: first(searchParams?.cursor) ?? ""
  };
  const limit = 50;
  const logs = await AuditService.list({
    appId: app.id,
    query: filters.q || undefined,
    action: filters.action || undefined,
    resourceType: filters.resourceType || undefined,
    resourceId: filters.resourceId || undefined,
    userId: filters.userId || undefined,
    from: toEpoch(filters.from),
    to: toEpoch(filters.to, true),
    cursor: filters.cursor || undefined,
    limit
  });
  const nextCursor = logs.length === limit ? logs[logs.length - 1]?.id : undefined;
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => key !== "cursor" && Boolean(value)).length;
  const resourceTypes = Array.from(new Set(logs.map((log) => log.resourceType))).slice(0, 8);

  return (
    <div className="container-page py-8 space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("common.auditLogs")}</h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-slate-400">{t("page.audit.description")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={activeFilterCount > 0 ? "accent" : "neutral"}>
            {activeFilterCount > 0 ? t("page.audit.filters", { count: formatNumber(activeFilterCount) }) : t("page.audit.unfiltered")}
          </Badge>
          <Badge tone="neutral">{t("page.audit.loaded", { count: formatNumber(logs.length) })}</Badge>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            {t("page.audit.filterTitle")}
          </CardTitle>
          <CardDescription>{t("page.audit.filterDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="grid gap-3 lg:grid-cols-12">
            <label className="relative block lg:col-span-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400 dark:text-slate-500" />
              <Input className="pl-9" name="q" defaultValue={filters.q} placeholder={t("page.audit.searchPlaceholder")} />
            </label>
            <Input className="lg:col-span-2" name="action" defaultValue={filters.action} placeholder={t("page.audit.actionPlaceholder")} />
            <Input
              className="lg:col-span-2"
              name="resourceType"
              defaultValue={filters.resourceType}
              placeholder={t("page.audit.resourceTypePlaceholder")}
            />
            <Input className="lg:col-span-2" name="resourceId" defaultValue={filters.resourceId} placeholder={t("page.audit.resourceIdPlaceholder")} />
            <Input className="lg:col-span-2" name="userId" defaultValue={filters.userId} placeholder={t("page.audit.userIdPlaceholder")} />
            <label className="grid gap-1 text-xs text-ink-500 dark:text-slate-400 lg:col-span-2">
              {t("page.audit.fromLabel")}
              <Input type="date" name="from" defaultValue={filters.from} />
            </label>
            <label className="grid gap-1 text-xs text-ink-500 dark:text-slate-400 lg:col-span-2">
              {t("page.audit.toLabel")}
              <Input type="date" name="to" defaultValue={filters.to} />
            </label>
            <div className="flex items-end gap-2 lg:col-span-8">
              <Button type="submit">{t("page.audit.apply")}</Button>
              <Button asChild type="button" variant="ghost">
                <Link href={`/console/apps/${app.id}/audit`}>{t("page.audit.reset")}</Link>
              </Button>
            </div>
          </form>

          {resourceTypes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {resourceTypes.map((type) => (
                <Button key={type} asChild size="xs" variant={filters.resourceType === type ? "secondary" : "outline"}>
                  <Link href={filterHref(app.id, { ...filters, resourceType: type, cursor: undefined })}>{type}</Link>
                </Button>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            {t("page.audit.resultsTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-ink-200/80 py-12 text-center text-sm text-ink-500 dark:border-slate-700 dark:text-slate-400">
              {t("page.audit.empty")}
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <article
                  key={log.id}
                  className="grid gap-4 rounded-lg border border-ink-100 bg-white/45 p-4 dark:border-slate-700/70 dark:bg-slate-900/30 lg:grid-cols-[minmax(220px,0.72fr)_minmax(0,1fr)]"
                >
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={actionTone(log.action)}>{log.action}</Badge>
                      <Badge tone="neutral">{log.resourceType}</Badge>
                    </div>
                    <div className="space-y-1 text-xs text-ink-500 dark:text-slate-400">
                      <div className="flex items-center gap-2">
                        <Clock3 className="h-3.5 w-3.5" />
                        {formatDateTime(log.createdAt)}
                      </div>
                      <div className="flex min-w-0 items-center gap-2">
                        <UserRound className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate font-mono">{log.userId ?? "system"}</span>
                      </div>
                      {(log.ip || log.requestId) && (
                        <div className="flex min-w-0 items-center gap-2">
                          <Network className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate font-mono">{[log.ip, log.requestId].filter(Boolean).join(" / ")}</span>
                        </div>
                      )}
                    </div>
                    {log.resourceId ? (
                      <Link
                        className="block truncate font-mono text-2xs text-accent-600 hover:underline dark:text-accent-300"
                        href={filterHref(app.id, { ...filters, resourceId: log.resourceId, cursor: undefined })}
                      >
                        {log.resourceId}
                      </Link>
                    ) : null}
                  </div>

                  <div className="min-w-0">
                    {!log.before && !log.after ? (
                      <div className="rounded-md border border-ink-100 bg-cream-50/70 px-3 py-6 text-center text-xs text-ink-400 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-500">
                        {t("page.audit.noPayload")}
                      </div>
                    ) : (
                      <div className="grid gap-3 xl:grid-cols-2">
                        {log.before ? <PayloadBlock title={t("page.audit.before")} value={preview(log.before)} /> : null}
                        {log.after ? <PayloadBlock title={t("page.audit.after")} value={preview(log.after)} /> : null}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
          {nextCursor && (
            <div className="mt-4 flex justify-end">
              <Button asChild variant="outline">
                <Link href={filterHref(app.id, { ...filters, cursor: nextCursor })}>{t("page.audit.nextPage")}</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PayloadBlock({ title, value }: { title: string; value: string }) {
  return (
    <details className="group min-w-0 rounded-md border border-ink-100 bg-cream-50/70 p-3 dark:border-slate-700 dark:bg-slate-950/30" open>
      <summary className="cursor-pointer text-xs font-medium text-ink-600 marker:text-ink-400 dark:text-slate-300">
        {title}
      </summary>
      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-2xs leading-5 text-ink-700 dark:text-slate-300">
        {value}
      </pre>
    </details>
  );
}
