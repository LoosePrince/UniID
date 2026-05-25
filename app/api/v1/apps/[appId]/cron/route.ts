import { z } from "zod";
import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { CronService } from "@/modules/cron";

const createSchema = z.object({
  name: z.string().min(1).max(64),
  cronExpr: z.string().min(1).max(64),
  fnId: z.string().min(1),
  payload: z.unknown().optional()
});

export const GET = withCors(
  "admin-only",
  defineRoute({
    handler: async (_input, { params }) => {
      const ctx = await requireAppAccess(String(params.appId));
      const items = await CronService.listForApp(ctx.app.id);
      return { items };
    }
  })
);

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { body: createSchema },
    handler: async ({ body }, { params }) => {
      const ctx = await requireAppAccess(String(params.appId));
      const job = await CronService.create({
        appId: ctx.app.id,
        name: body.name,
        cronExpr: body.cronExpr,
        fnId: body.fnId,
        payload: body.payload,
        createdById: ctx.user.id
      });
      return { job };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
