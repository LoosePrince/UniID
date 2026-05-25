import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { tryGetSdkAuth } from "@/shared/iam";
import { FileService } from "@/modules/files";
import { ApiError } from "@/shared/errors";
import { prisma } from "@/shared/prisma";

const params = z.object({ fileId: idSchema });

export const GET = withCors(
  "app-domain",
  defineRoute({
    schema: { params },
    handler: async ({ params: p }, { req }) => {
      const file = await prisma.fileObject.findUnique({ where: { id: p.fileId } });
      if (!file || file.deletedAt) throw new ApiError("FILE_NOT_FOUND");
      if (file.visibility !== "public") {
        const auth = await tryGetSdkAuth(req as never);
        if (!auth || auth.user.id !== file.ownerId) throw new ApiError("FILE_FORBIDDEN");
      }
      const url = await FileService.getDownloadUrl(p.fileId);
      return { url };
    }
  })
);

export const OPTIONS = withCors("app-domain", async () => new Response(null, { status: 204 }));
