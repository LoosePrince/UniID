import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { CronService } from "@/modules/cron";

const params = z.object({ appId: idSchema, jobId: idSchema });
const patchSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  cronExpr: z.string().min(1).max(64).optional(),
  fnId: idSchema.optional(),
  payload: z.unknown().optional(),
  isActive: z.boolean().optional()
});

export const PATCH = withCors(
  "admin-only",
  defineRoute({
    schema: { params, body: patchSchema },
    handler: async ({ params: p, body }) => {
      const ctx = await requireAppAccess(p.appId);
      const job = await CronService.update({
        appId: ctx.app.id,
        jobId: p.jobId,
        name: body.name,
        cronExpr: body.cronExpr,
        fnId: body.fnId,
        payload: body.payload,
        isActive: body.isActive
      });
      return { job };
    }
  })
);

export const DELETE = withCors(
  "admin-only",
  defineRoute({
    schema: { params },
    handler: async ({ params: p }) => {
      const ctx = await requireAppAccess(p.appId);
      await CronService.deleteOne(ctx.app.id, p.jobId);
      return { success: true };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
