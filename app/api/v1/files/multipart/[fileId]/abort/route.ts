import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireSdkAuth } from "@/shared/iam";
import { FileService } from "@/modules/files";

export const POST = withCors(
  "app-domain",
  defineRoute({
    handler: async (_input, { req, params }) => {
      const auth = await requireSdkAuth(req);
      await FileService.abortMultipart({
        fileId: String(params.fileId),
        actorId: auth.user.id
      });
      return { success: true };
    }
  })
);

export const OPTIONS = withCors("app-domain", async () => new Response(null, { status: 204 }));
