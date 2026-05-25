import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { CronService } from "@/modules/cron";

const params = z.object({ appId: idSchema, jobId: idSchema });

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { params },
    handler: async ({ params: p }) => {
      const ctx = await requireAppAccess(p.appId);
      const result = await CronService.runNow(ctx.app.id, p.jobId);
      return result;
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));