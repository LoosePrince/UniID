import { z } from "zod";
import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { CronService } from "@/modules/cron";

const patchSchema = z.object({
  isActive: z.boolean().optional()
});

export const PATCH = withCors(
  "admin-only",
  defineRoute({
    schema: { body: patchSchema },
    handler: async ({ body }, { params }) => {
      await requireAppAccess(String(params.appId));
      if (body.isActive !== undefined) {
        const job = await CronService.setActive(String(params.jobId), body.isActive);
        return { job };
      }
      return { ok: true };
    }
  })
);

export const DELETE = withCors(
  "admin-only",
  defineRoute({
    handler: async (_input, { params }) => {
      await requireAppAccess(String(params.appId));
      await CronService.deleteOne(String(params.jobId));
      return { success: true };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
