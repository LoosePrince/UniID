import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { AppService } from "@/modules/apps";

const params = z.object({ appId: idSchema, keyId: idSchema });
const patchSchema = z.object({
  label: z.string().min(1).max(80).optional(),
  scopes: z.array(z.string().min(1).max(80)).max(50).optional()
});

export const PATCH = withCors(
  "admin-only",
  defineRoute({
    schema: { params, body: patchSchema },
    handler: async ({ params: p, body }) => {
      const ctx = await requireAppAccess(p.appId);
      const key = await AppService.updateApiKey({
        appId: ctx.app.id,
        keyId: p.keyId,
        actorUserId: ctx.user.id,
        actorRole: ctx.user.role,
        label: body.label,
        scopes: body.scopes
      });
      return { key };
    }
  })
);

export const DELETE = withCors(
  "admin-only",
  defineRoute({
    schema: { params },
    handler: async ({ params: p }) => {
      const ctx = await requireAppAccess(p.appId);
      await AppService.revokeApiKey(ctx.app.id, p.keyId, ctx.user.id, ctx.user.role);
      return { success: true };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
