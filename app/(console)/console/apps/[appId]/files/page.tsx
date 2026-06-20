import { notFound } from "next/navigation";
import { requireConsoleAuth } from "@/shared/iam";
import { prisma } from "@/shared/prisma";
import { AppService } from "@/modules/apps";
import { FilesWorkspace } from "@/ui/console/files-workspace";

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

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const sharedCount = files.filter((file) => Boolean(file.shareTokens[0])).length;
  const publicCount = files.filter((file) => file.visibility === "public").length;

  return (
    <div className="container-page py-8">
      <FilesWorkspace
        appId={app.id}
        files={files.map((file) => ({
          id: file.id,
          originalName: file.originalName,
          ownerId: file.ownerId,
          mimeType: file.mimeType,
          visibility: file.visibility,
          size: file.size,
          createdAt: file.createdAt,
          shareUrl: file.shareTokens[0] ? `/api/v1/files/public/${file.shareTokens[0].token}` : null
        }))}
        totalSize={totalSize}
        sharedCount={sharedCount}
        publicCount={publicCount}
      />
    </div>
  );
}
