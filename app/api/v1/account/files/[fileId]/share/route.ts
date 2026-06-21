import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireConsoleAuth } from "@/shared/iam";
import { ApiError } from "@/shared/errors";
import { FileService } from "@/modules/files";
import { getSystemConfig } from "@/shared/system-config";
import { prisma } from "@/shared/prisma";

const params = z.object({ fileId: idSchema });
const body = z.object({ ttl: z.number().int().positive().max(60 * 60 * 24 * 30).optional() });

async function requireOwnedFile(fileId: string, ownerId: string) {
  const file = await prisma.fileObject.findUnique({ where: { id: fileId } });
  if (!file || file.deletedAt) throw new ApiError("FILE_NOT_FOUND");
  if (file.ownerId !== ownerId) throw new ApiError("FILE_FORBIDDEN");
  return file;
}

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { params, body },
    handler: async ({ params: p, body }) => {
      const auth = await requireConsoleAuth();
      await requireOwnedFile(p.fileId, auth.user.id);
      const token = await FileService.createShareToken(p.fileId, auth.user.id, body.ttl);
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
      const auth = await requireConsoleAuth();
      await requireOwnedFile(p.fileId, auth.user.id);
      const revoked = await FileService.revokeShareTokens(p.fileId, auth.user.id);
      return { success: true, revoked };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
