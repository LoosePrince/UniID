import { notFound } from "next/navigation";
import { normalizeLocale, createI18n } from "@/shared/i18n";
import { requireConsoleAuth } from "@/shared/iam";
import { prisma } from "@/shared/prisma";
import { AppService } from "@/modules/apps";
import { Badge, Card, CardContent } from "@/ui/primitives";
import { AppFileUploadButton, FileRowActions } from "@/ui/console/file-actions";

export default async function AppFilesPage({ params }: { params: { appId: string } }) {
  const auth = await requireConsoleAuth();
  const { t, formatBytes, formatDateTime } = createI18n(normalizeLocale(auth.user.locale));
  const app = await prisma.app.findUnique({
    where: { id: params.appId },
    include: { admins: true }
  });
  if (!app) notFound();
  if (auth.user.role !== "admin") {
    await AppService.requireOwnerOrAdmin(app.ownerId, app.admins, auth.user.id);
  }

  const files = await prisma.fileObject.findMany({
    where: { appId: app.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      shareTokens: {
        where: { revokedAt: null, expiresAt: { gt: Math.floor(Date.now() / 1000) } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { token: true, expiresAt: true }
      }
    }
  });

  return (
    <div className="container-page py-8 space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("common.files")}</h1>
          <p className="text-sm text-ink-500 mt-1 dark:text-slate-400">{t("appFiles.description")}</p>
        </div>
        <AppFileUploadButton appId={app.id} />
      </header>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-ink-100 bg-cream-100 text-ink-500 text-xs dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-300">
              <tr>
                <th className="text-left px-4 py-2 font-medium">{t("accountFiles.name")}</th>
                <th className="text-left px-4 py-2 font-medium">{t("appFiles.owner")}</th>
                <th className="text-left px-4 py-2 font-medium">{t("accountFiles.type")}</th>
                <th className="text-left px-4 py-2 font-medium">{t("appFiles.visibility")}</th>
                <th className="text-left px-4 py-2 font-medium">{t("accountFiles.share")}</th>
                <th className="text-right px-4 py-2 font-medium">{t("accountFiles.size")}</th>
                <th className="text-right px-4 py-2 font-medium">{t("appFiles.uploadedAt")}</th>
                <th className="text-right px-4 py-2 font-medium">{t("accountFiles.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {files.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-ink-400 dark:text-slate-500">
                    {t("appFiles.empty")}
                  </td>
                </tr>
              )}
              {files.map((f) => (
                <tr
                  key={f.id}
                  className="border-t border-ink-100 bg-white/40 transition-colors hover:bg-cream-50 dark:border-slate-700/70 dark:bg-slate-950/10 dark:hover:bg-slate-800/50"
                >
                  <td className="px-4 py-2 truncate max-w-xs text-ink-800 dark:text-slate-200">{f.originalName}</td>
                  <td className="px-4 py-2 text-xs text-ink-500 font-mono truncate max-w-[120px] dark:text-slate-400">
                    {f.ownerId}
                  </td>
                  <td className="px-4 py-2 text-xs text-ink-500 font-mono dark:text-slate-400">{f.mimeType}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      <Badge tone={f.visibility === "public" ? "accent" : "neutral"}>{f.visibility}</Badge>
                      {f.shareTokens[0] ? <Badge tone="success">{t("accountFiles.shared")}</Badge> : null}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-xs text-ink-500 dark:text-slate-400">
                    {f.shareTokens[0] ? formatDateTime(f.shareTokens[0].expiresAt) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-ink-700 dark:text-slate-300">{formatBytes(f.size)}</td>
                  <td className="px-4 py-2 text-right text-xs text-ink-500 dark:text-slate-400">
                    {formatDateTime(f.createdAt)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <FileRowActions
                      basePath={`/api/v1/apps/${app.id}/files`}
                      file={{
                        id: f.id,
                        originalName: f.originalName,
                        shareUrl: f.shareTokens[0] ? `/api/v1/files/public/${f.shareTokens[0].token}` : null
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
