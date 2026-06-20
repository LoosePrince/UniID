import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { FunctionsService } from "@/modules/functions";

const params = z.object({ appId: idSchema });
const createSchema = z.object({
  name: z.string().min(1).max(64),
  fnId: idSchema,
  events: z.array(z.string().min(1).max(80)).min(1).max(20),
  filter: z.record(z.unknown()).nullable().optional(),
  isActive: z.boolean().optional()
});

export const GET = withCors(
  "admin-only",
  defineRoute({
    schema: { params },
    handler: async ({ params: p }) => {
      const ctx = await requireAppAccess(p.appId);
      const items = await FunctionsService.listEventTriggers(ctx.app.id);
      return { items };
    }
  })
);

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { params, body: createSchema },
    handler: async ({ params: p, body }) => {
      const ctx = await requireAppAccess(p.appId);
      const trigger = await FunctionsService.createEventTrigger({
        appId: ctx.app.id,
        name: body.name,
        fnId: body.fnId,
        events: body.events,
        filter: body.filter ?? undefined,
        isActive: body.isActive,
        createdById: ctx.user.id
      });
      return { trigger };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
