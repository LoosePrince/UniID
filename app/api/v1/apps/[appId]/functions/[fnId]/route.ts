import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { FunctionsService } from "@/modules/functions";

const params = z.object({ appId: idSchema, fnId: idSchema });
const patchSchema = z.object({
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
  memoryMb: z.number().int().min(16).max(512).optional(),
  timeoutMs: z.number().int().min(100).max(60_000).optional(),
  env: z.record(z.string()).nullable().optional()
});

export const PATCH = withCors(
  "admin-only",
  defineRoute({
    schema: { params, body: patchSchema },
    handler: async ({ params: p, body }) => {
      const ctx = await requireAppAccess(p.appId);
      const fn = await FunctionsService.update({
        appId: ctx.app.id,
        fnId: p.fnId,
        description: body.description,
        isActive: body.isActive,
        memoryMb: body.memoryMb,
        timeoutMs: body.timeoutMs,
        env: body.env
      });
      return { fn };
    }
  })
);

export const DELETE = withCors(
  "admin-only",
  defineRoute({
    schema: { params },
    handler: async ({ params: p }) => {
      const ctx = await requireAppAccess(p.appId);
      await FunctionsService.deleteOne(ctx.app.id, p.fnId);
      return { success: true };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));