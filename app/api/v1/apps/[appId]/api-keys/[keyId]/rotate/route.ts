import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { AppService } from "@/modules/apps";

const params = z.object({ appId: idSchema, keyId: idSchema });

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { params },
    handler: async ({ params: p }) => {
      const ctx = await requireAppAccess(p.appId);
      return AppService.rotateApiKey(ctx.app.id, p.keyId, ctx.user.id, ctx.user.role);
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
