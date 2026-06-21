import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { ApiError } from "@/shared/errors";
import { FileService } from "@/modules/files";
import { getSystemConfig } from "@/shared/system-config";
import { prisma } from "@/shared/prisma";

const params = z.object({ appId: idSchema, fileId: idSchema });
const body = z.object({ ttl: z.number().int().positive().max(60 * 60 * 24 * 30).optional() });

async function requireAppFile(appId: string, fileId: string) {
  const file = await prisma.fileObject.findUnique({ where: { id: fileId } });
  if (!file || file.deletedAt || file.appId !== appId) throw new ApiError("FILE_NOT_FOUND");
  return file;
}

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { params, body },
    handler: async ({ params: p, body }) => {
      const auth = await requireAppAccess(p.appId);
      await requireAppFile(auth.app.id, p.fileId);
      const token = await FileService.createShareTokenForAuthorizedFile(p.fileId, auth.user.id, body.ttl);
      const ttl = body.ttl ?? (await getSystemConfig()).fileShareTokenTtlSeconds;
      return {
        token,
        url: `/api/v1/files/public/${token}`,
        expiresAt: Math.floor(Date.now() / 1000) + ttl
      };
    }
  })
);

export const DELETE = withCors(
  "admin-only",
  defineRoute({
    schema: { params },
    handler: async ({ params: p }) => {
      const auth = await requireAppAccess(p.appId);
      await requireAppFile(auth.app.id, p.fileId);
      const revoked = await FileService.revokeShareTokensForAuthorizedFile(p.fileId);
      return { success: true, revoked };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
