/**
 * GET    /api/v1/files/[fileId]   读取元数据
 * DELETE /api/v1/files/[fileId]   软删除
 */
import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireSdkAuth, tryGetSdkAuth } from "@/shared/iam";
import { prisma } from "@/shared/prisma";
import { ApiError } from "@/shared/errors";
import { FileService } from "@/modules/files";

const params = z.object({ fileId: idSchema });

export const GET = withCors(
  "app-domain",
  defineRoute({
    schema: { params },
    handler: async ({ params: p }, { req }) => {
      const file = await prisma.fileObject.findUnique({ where: { id: p.fileId } });
      if (!file || file.deletedAt) throw new ApiError("FILE_NOT_FOUND");
      if (file.visibility === "public") {
        return { file };
      }
      const auth = await tryGetSdkAuth(req as never);
      if (!auth) throw new ApiError("FILE_FORBIDDEN");
      if (auth.user.id !== file.ownerId) throw new ApiError("FILE_FORBIDDEN");
      return { file };
    }
  })
);

export const DELETE = withCors(
  "app-domain",
  defineRoute({
    schema: { params },
    handler: async ({ params: p }, { req }) => {
      const auth = await requireSdkAuth(req as never);
      await FileService.delete(p.fileId, auth.user.id);
      return { success: true };
    }
  })
);

export const OPTIONS = withCors("app-domain", async () => new Response(null, { status: 204 }));
