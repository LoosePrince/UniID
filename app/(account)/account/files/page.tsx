import { normalizeLocale, createI18n } from "@/shared/i18n";
import { requireConsoleAuth } from "@/shared/iam";
import { prisma } from "@/shared/prisma";
import { Badge, Card, CardContent } from "@/ui/primitives";
import { FileRowActions } from "@/ui/console/file-actions";

export default async function AccountFilesPage() {
  const auth = await requireConsoleAuth();
  const { t, formatBytes, formatDateTime } = createI18n(normalizeLocale(auth.user.locale));
  const files = await prisma.fileObject.findMany({
    where: { ownerId: auth.user.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      app: { select: { name: true, primaryDomain: true } },
      shareTokens: {
        where: { revokedAt: null, expiresAt: { gt: Math.floor(Date.now() / 1000) } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { token: true, expiresAt: true }
      }
    }
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{t("accountFiles.title")}</h1>
        <p className="text-sm text-ink-500 mt-1 dark:text-slate-400">{t("accountFiles.description")}</p>
      </header>
      {files.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-ink-500 dark:text-slate-400">
            {t("accountFiles.empty")}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-cream-100 text-ink-500 text-xs dark:bg-slate-800/70 dark:text-slate-300">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">{t("accountFiles.name")}</th>
                  <th className="text-left px-4 py-2 font-medium">{t("accountFiles.app")}</th>
                  <th className="text-left px-4 py-2 font-medium">{t("accountFiles.type")}</th>
                  <th className="text-left px-4 py-2 font-medium">{t("accountFiles.share")}</th>
                  <th className="text-right px-4 py-2 font-medium">{t("accountFiles.size")}</th>
                  <th className="text-right px-4 py-2 font-medium">{t("accountFiles.time")}</th>
                  <th className="text-right px-4 py-2 font-medium">{t("accountFiles.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.id} className="border-t border-ink-100 dark:border-slate-700/70 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-2 truncate max-w-xs">{f.originalName}</td>
                    <td className="px-4 py-2 text-ink-500 dark:text-slate-400">{f.app?.name ?? t("accountFiles.noApp")}</td>
                    <td className="px-4 py-2 text-ink-500 font-mono text-xs dark:text-slate-400">{f.mimeType}</td>
                    <td className="px-4 py-2">
                      {f.shareTokens[0] ? (
                        <div className="space-y-1">
                          <Badge tone="success">{t("accountFiles.shared")}</Badge>
                          <p className="text-2xs text-ink-400 dark:text-slate-500">
                            {t("accountFiles.expiresAt", { time: formatDateTime(f.shareTokens[0].expiresAt) })}
                          </p>
                        </div>
                      ) : (
                        <Badge tone="neutral">{t("accountFiles.private")}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatBytes(f.size)}</td>
                    <td className="px-4 py-2 text-right text-ink-500 text-xs dark:text-slate-400">
                      {formatDateTime(f.createdAt)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <FileRowActions
                        basePath="/api/v1/account/files"
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
      )}
    </div>
  );
}
