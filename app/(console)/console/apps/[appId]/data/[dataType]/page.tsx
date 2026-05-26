import { notFound } from "next/navigation";
import { normalizeLocale, createI18n } from "@/shared/i18n";
import { requireConsoleAuth } from "@/shared/iam";
import { prisma } from "@/shared/prisma";
import { AppService } from "@/modules/apps";
import { Card, CardContent } from "@/ui/primitives";
import { CreateRecordButton, RecordRowActions } from "@/ui/console/data-record-actions";

function parseRecordData(source: string): unknown {
  try {
    return JSON.parse(source) as unknown;
  } catch {
    return {};
  }
}

function previewRecordData(source: string) {
  const normalized = source.replace(/\s+/g, " ").trim();
  return normalized.length > 120 ? `${normalized.slice(0, 120)}…` : normalized;
}

export default async function DataBrowserPage({
  params
}: {
  params: { appId: string; dataType: string };
}) {
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

  const [schema, total, records] = await Promise.all([
    prisma.dataSchema.findUnique({
      where: { appId_dataType: { appId: app.id, dataType: params.dataType } },
      include: { versions: { where: { isActive: 1 }, take: 1 } }
    }),
    prisma.record.count({ where: { appId: app.id, dataType: params.dataType, deletedAt: null } }),
    prisma.record.findMany({
      where: { appId: app.id, dataType: params.dataType, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 100
    })
  ]);

  if (!schema) notFound();

  return (
    <div className="container-page py-8 space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            <span className="text-ink-400 dark:text-slate-500">data /</span>{" "}
            <span className="font-mono">{params.dataType}</span>
          </h1>
          <p className="text-sm text-ink-500 mt-1 dark:text-slate-400">
            {t("data.browserSummary", {
              total: formatNumber(total),
              shown: formatNumber(records.length),
              version: String(schema.versions[0]?.version ?? "—")
            })}
          </p>
        </div>
        <CreateRecordButton appId={app.id} dataType={params.dataType} />
      </header>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-ink-100 bg-cream-100 text-ink-500 text-xs dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-300">
              <tr>
                <th className="text-left px-4 py-2 font-medium">{t("data.col.id")}</th>
                <th className="text-left px-4 py-2 font-medium">{t("data.col.owner")}</th>
                <th className="text-left px-4 py-2 font-medium">{t("data.col.data")}</th>
                <th className="text-right px-4 py-2 font-medium">{t("data.col.updated")}</th>
                <th className="text-right px-4 py-2 font-medium">{t("schema.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <div className="mx-auto max-w-sm space-y-3">
                      <p className="text-sm font-medium text-ink-700 dark:text-slate-200">{t("data.noRecords")}</p>
                      <p className="text-xs text-ink-500 dark:text-slate-400">{t("data.noRecordsHint")}</p>
                      <CreateRecordButton appId={app.id} dataType={params.dataType} />
                    </div>
                  </td>
                </tr>
              )}
              {records.map((record) => {
                const parsed = parseRecordData(record.data);
                return (
                  <tr key={record.id} className="border-t border-ink-100 bg-white/40 transition-colors hover:bg-cream-50 dark:border-slate-700/70 dark:bg-slate-950/10 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-mono text-xs text-ink-600 whitespace-nowrap dark:text-slate-300">
                      {record.id}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-500 whitespace-nowrap dark:text-slate-400">
                      {record.ownerId ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-700 max-w-xl dark:text-slate-300">
                      <span className="line-clamp-2 break-all">{previewRecordData(record.data)}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-ink-500 whitespace-nowrap dark:text-slate-400">
                      {formatDateTime(record.updatedAt)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <RecordRowActions
                        appId={app.id}
                        dataType={params.dataType}
                        recordId={record.id}
                        initialData={parsed}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
