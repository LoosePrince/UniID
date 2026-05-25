import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { WebhooksService } from "@/modules/webhooks";

const params = z.object({ appId: idSchema, hookId: idSchema });
const patchSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  url: z.string().url().optional(),
  events: z.array(z.string().min(1)).min(1).max(20).optional(),
  isActive: z.boolean().optional(),
  rotateSecret: z.boolean().optional()
});

export const PATCH = withCors(
  "admin-only",
  defineRoute({
    schema: { params, body: patchSchema },
    handler: async ({ params: p, body }) => {
      const ctx = await requireAppAccess(p.appId);
      let hook = await WebhooksService.update({
        appId: ctx.app.id,
        hookId: p.hookId,
        name: body.name,
        url: body.url,
        events: body.events,
        isActive: body.isActive
      });
      if (body.rotateSecret) {
        hook = await WebhooksService.rotateSecret(ctx.app.id, p.hookId);
      }
      return { hook };
    }
  })
);

export const DELETE = withCors(
  "admin-only",
  defineRoute({
    schema: { params },
    handler: async ({ params: p }) => {
      const ctx = await requireAppAccess(p.appId);
      await WebhooksService.deleteOne(ctx.app.id, p.hookId);
      return { success: true };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
