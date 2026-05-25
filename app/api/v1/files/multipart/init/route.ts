import { z } from "zod";
import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireSdkAuth } from "@/shared/iam";
import { FileService } from "@/modules/files";

const bodySchema = z.object({
  originalName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(128),
  visibility: z.enum(["private", "public"]).optional()
});

export const POST = withCors(
  "app-domain",
  defineRoute({
    schema: { body: bodySchema },
    handler: async ({ body }, { req }) => {
      const auth = await requireSdkAuth(req);
      const result = await FileService.initMultipart({
        ownerId: auth.user.id,
        appId: auth.app.id,
        originalName: body.originalName,
        mimeType: body.mimeType,
        visibility: body.visibility
      });
      return { upload: result };
    }
  })
);

export const OPTIONS = withCors("app-domain", async () => new Response(null, { status: 204 }));
