import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { FunctionsService } from "@/modules/functions";

const params = z.object({ appId: idSchema, triggerId: idSchema });
const patchSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  fnId: idSchema.optional(),
  events: z.array(z.string().min(1).max(80)).min(1).max(20).optional(),
  filter: z.record(z.unknown()).nullable().optional(),
  isActive: z.boolean().optional()
});

export const PATCH = withCors(
  "admin-only",
  defineRoute({
    schema: { params, body: patchSchema },
    handler: async ({ params: p, body }) => {
      const ctx = await requireAppAccess(p.appId);
      const trigger = await FunctionsService.updateEventTrigger({
        appId: ctx.app.id,
        triggerId: p.triggerId,
        name: body.name,
        fnId: body.fnId,
        events: body.events,
        filter: body.filter,
        isActive: body.isActive
      });
      return { trigger };
    }
  })
);

export const DELETE = withCors(
  "admin-only",
  defineRoute({
    schema: { params },
    handler: async ({ params: p }) => {
      const ctx = await requireAppAccess(p.appId);
      await FunctionsService.deleteEventTrigger(ctx.app.id, p.triggerId);
      return { success: true };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
