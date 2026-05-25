/**
 * POST /api/v1/files/share { fileId, ttl? } → { token, expiresAt }
 *
 * 创建分享 token。
 */
import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireSdkAuth } from "@/shared/iam";
import { FileService } from "@/modules/files";
import { config } from "@/shared/config";

const body = z.object({ fileId: idSchema, ttl: z.number().int().positive().max(60 * 60 * 24 * 30).optional() });

export const POST = withCors(
  "app-domain",
  defineRoute({
    schema: { body },
    handler: async ({ body }, { req }) => {
      const auth = await requireSdkAuth(req as never);
      const token = await FileService.createShareToken(body.fileId, auth.user.id, body.ttl);
      const ttl = body.ttl ?? config().FILE_SHARE_TOKEN_TTL_SECONDS;
      return {
        token,
        url: `/api/v1/files/public/${token}`,
        expiresAt: Math.floor(Date.now() / 1000) + ttl
      };
    }
  })
);

export const OPTIONS = withCors("app-domain", async () => new Response(null, { status: 204 }));
