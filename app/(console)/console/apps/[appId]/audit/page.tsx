import Link from "next/link";
import { notFound } from "next/navigation";
import { normalizeLocale, createI18n } from "@/shared/i18n";
import { requireConsoleAuth } from "@/shared/iam";
import { prisma } from "@/shared/prisma";
import { AppService } from "@/modules/apps";
import { AuditService } from "@/shared/audit";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell
} from "@/ui/primitives";

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

function preview(value: string | null | undefined) {
  if (!value) return "";
  try {
    return JSON.stringify(JSON.parse(value), null, 2).slice(0, 600);
  } catch {
    return value.slice(0, 600);
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

export default async function AuditPage({ params, searchParams }: PageProps) {
  const auth = await requireConsoleAuth();
  const { t, formatDateTime } = createI18n(normalizeLocale(auth.user.locale));
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

  return (
    <div className="container-page py-8 space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{t("common.auditLogs")}</h1>
        <p className="text-sm text-ink-500 mt-1">{t("page.audit.description")}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("page.audit.filterTitle")}</CardTitle>
          <CardDescription>{t("page.audit.filterDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 lg:grid-cols-6">
            <Input className="lg:col-span-2" name="q" defaultValue={filters.q} placeholder={t("page.audit.searchPlaceholder")} />
            <Input name="action" defaultValue={filters.action} placeholder={t("page.audit.actionPlaceholder")} />
            <Input name="resourceType" defaultValue={filters.resourceType} placeholder={t("page.audit.resourceTypePlaceholder")} />
            <Input name="resourceId" defaultValue={filters.resourceId} placeholder={t("page.audit.resourceIdPlaceholder")} />
            <Input name="userId" defaultValue={filters.userId} placeholder={t("page.audit.userIdPlaceholder")} />
            <label className="grid gap-1 text-xs text-ink-500">
              {t("page.audit.fromLabel")}
              <Input type="date" name="from" defaultValue={filters.from} />
            </label>
            <label className="grid gap-1 text-xs text-ink-500">
              {t("page.audit.toLabel")}
              <Input type="date" name="to" defaultValue={filters.to} />
            </label>
            <div className="flex items-end gap-2 lg:col-span-4">
              <Button type="submit">{t("page.audit.apply")}</Button>
              <Button asChild type="button" variant="ghost">
                <Link href={`/console/apps/${app.id}/audit`}>{t("page.audit.reset")}</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("page.audit.resultsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="py-12 text-center text-sm text-ink-500">{t("page.audit.empty")}</div>
          ) : (
            <TableShell>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("page.audit.colTime")}</TableHead>
                    <TableHead>{t("page.audit.colAction")}</TableHead>
                    <TableHead>{t("page.audit.colResource")}</TableHead>
                    <TableHead>{t("page.audit.colActor")}</TableHead>
                    <TableHead>{t("page.audit.colChange")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-xs">{formatDateTime(log.createdAt)}</TableCell>
                      <TableCell>
                        <Badge tone="neutral">{log.action}</Badge>
                        {(log.ip || log.requestId) && (
                          <div className="mt-1 text-2xs text-ink-400">
                            {t("page.audit.network")}: {[log.ip, log.requestId].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[220px]">
                        <div className="font-mono text-xs text-ink-800 dark:text-slate-200">{log.resourceType}</div>
                        {log.resourceId && <div className="truncate font-mono text-2xs text-ink-400">{log.resourceId}</div>}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate font-mono text-xs">
                        {log.userId ?? "system"}
                      </TableCell>
                      <TableCell className="max-w-[420px]">
                        <div className="grid gap-2 text-2xs lg:grid-cols-2">
                          {log.before && (
                            <div className="min-w-0 rounded-md bg-cream-100/70 p-2 dark:bg-slate-800/70">
                              <div className="mb-1 font-medium text-ink-500">{t("page.audit.before")}</div>
                              <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-words font-mono">{preview(log.before)}</pre>
                            </div>
                          )}
                          {log.after && (
                            <div className="min-w-0 rounded-md bg-cream-100/70 p-2 dark:bg-slate-800/70">
                              <div className="mb-1 font-medium text-ink-500">{t("page.audit.after")}</div>
                              <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-words font-mono">{preview(log.after)}</pre>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableShell>
          )}
          {nextCursor && (
            <div className="mt-3 flex justify-end">
              <Button asChild variant="ghost">
                <Link href={filterHref(app.id, { ...filters, cursor: nextCursor })}>Next</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
