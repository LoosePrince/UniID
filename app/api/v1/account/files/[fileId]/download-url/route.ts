import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireConsoleAuth } from "@/shared/iam";
import { ApiError } from "@/shared/errors";
import { FileService } from "@/modules/files";
import { prisma } from "@/shared/prisma";

const params = z.object({ fileId: idSchema });

async function requireOwnedFile(fileId: string, ownerId: string) {
  const file = await prisma.fileObject.findUnique({ where: { id: fileId } });
  if (!file || file.deletedAt) throw new ApiError("FILE_NOT_FOUND");
  if (file.ownerId !== ownerId) throw new ApiError("FILE_FORBIDDEN");
  return file;
}

export const GET = withCors(
  "admin-only",
  defineRoute({
    schema: { params },
    handler: async ({ params: p }) => {
      const auth = await requireConsoleAuth();
      await requireOwnedFile(p.fileId, auth.user.id);
      const url = await FileService.getDownloadUrl(p.fileId);
      return { url };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));