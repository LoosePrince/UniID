import { notFound } from "next/navigation";
import { requireConsoleAuth } from "@/shared/iam";
import { prisma } from "@/shared/prisma";
import { AppService } from "@/modules/apps";
import { FileService } from "@/modules/files";
import { Badge, Card, CardContent } from "@/ui/primitives";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default async function AppFilesPage({ params }: { params: { appId: string } }) {
  const auth = await requireConsoleAuth();
  const app = await prisma.app.findUnique({
    where: { id: params.appId },
    include: { admins: true }
  });
  if (!app) notFound();
  if (auth.user.role !== "admin") {
    await AppService.requireOwnerOrAdmin(app.ownerId, app.admins, auth.user.id);
  }

  const files = await FileService.list({ appId: app.id, limit: 200 });

  return (
    <div className="container-page py-8 space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">文件</h1>
        <p className="text-sm text-ink-500 mt-1">该应用的所有上传文件（最多展示 200 个）。</p>
      </header>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream-100 text-ink-500 text-xs">
              <tr>
                <th className="text-left px-4 py-2 font-medium">名称</th>
                <th className="text-left px-4 py-2 font-medium">所有者</th>
                <th className="text-left px-4 py-2 font-medium">类型</th>
                <th className="text-left px-4 py-2 font-medium">可见性</th>
                <th className="text-right px-4 py-2 font-medium">大小</th>
                <th className="text-right px-4 py-2 font-medium">上传时间</th>
              </tr>
            </thead>
            <tbody>
              {files.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-ink-400">暂无文件</td></tr>
              )}
              {files.map((f) => (
                <tr key={f.id} className="border-t border-ink-100">
                  <td className="px-4 py-2 truncate max-w-xs">{f.originalName}</td>
                  <td className="px-4 py-2 text-xs text-ink-500 font-mono truncate max-w-[120px]">{f.ownerId}</td>
                  <td className="px-4 py-2 text-xs text-ink-500 font-mono">{f.mimeType}</td>
                  <td className="px-4 py-2"><Badge tone={f.visibility === "public" ? "accent" : "neutral"}>{f.visibility}</Badge></td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatBytes(f.size)}</td>
                  <td className="px-4 py-2 text-right text-xs text-ink-500">
                    {new Date(f.createdAt * 1000).toLocaleString()}
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
