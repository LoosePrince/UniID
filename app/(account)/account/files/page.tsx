import { requireConsoleAuth } from "@/shared/iam";
import { prisma } from "@/shared/prisma";
import { Badge, Card, CardContent } from "@/ui/primitives";
import { FileRowActions } from "@/ui/console/file-actions";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default async function AccountFilesPage() {
  const auth = await requireConsoleAuth();
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
        <h1 className="text-xl font-semibold tracking-tight">我的文件</h1>
        <p className="text-sm text-ink-500 mt-1">所有由你账号上传到任意应用的文件。</p>
      </header>
      {files.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-ink-500">暂无文件。</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-cream-100 text-ink-500 text-xs">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">名称</th>
                  <th className="text-left px-4 py-2 font-medium">应用</th>
                  <th className="text-left px-4 py-2 font-medium">类型</th>
                  <th className="text-left px-4 py-2 font-medium">分享</th>
                  <th className="text-right px-4 py-2 font-medium">大小</th>
                  <th className="text-right px-4 py-2 font-medium">时间</th>
                  <th className="text-right px-4 py-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.id} className="border-t border-ink-100">
                    <td className="px-4 py-2 truncate max-w-xs">{f.originalName}</td>
                    <td className="px-4 py-2 text-ink-500">{f.app?.name ?? "（无）"}</td>
                    <td className="px-4 py-2 text-ink-500 font-mono text-xs">{f.mimeType}</td>
                    <td className="px-4 py-2">
                      {f.shareTokens[0] ? (
                        <div className="space-y-1">
                          <Badge tone="success">shared</Badge>
                          <p className="text-2xs text-ink-400">
                            至 {new Date(f.shareTokens[0].expiresAt * 1000).toLocaleString()}
                          </p>
                        </div>
                      ) : (
                        <Badge tone="neutral">private</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatBytes(f.size)}</td>
                    <td className="px-4 py-2 text-right text-ink-500 text-xs">
                      {new Date(f.createdAt * 1000).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <FileRowActions
                        basePath="/api/v1/account/files"
                        file={{
                          id: f.id,
                          originalName: f.originalName,
                          shareUrl: f.shareTokens[0]
                            ? `/api/v1/files/public/${f.shareTokens[0].token}`
                            : null
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
