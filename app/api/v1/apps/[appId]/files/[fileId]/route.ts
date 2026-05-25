import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { ApiError } from "@/shared/errors";
import { FileService } from "@/modules/files";
import { prisma } from "@/shared/prisma";

const params = z.object({ appId: idSchema, fileId: idSchema });

async function requireAppFile(appId: string, fileId: string) {
  const file = await prisma.fileObject.findUnique({ where: { id: fileId } });
  if (!file || file.deletedAt || file.appId !== appId) throw new ApiError("FILE_NOT_FOUND");
  return file;
}

export const DELETE = withCors(
  "admin-only",
  defineRoute({
    schema: { params },
    handler: async ({ params: p }) => {
      const auth = await requireAppAccess(p.appId);
      await requireAppFile(auth.app.id, p.fileId);
      await FileService.deleteAuthorizedFile(p.fileId);
      return { success: true };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));