import { z } from "zod";
import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { FunctionsService } from "@/modules/functions";

const createSchema = z.object({
  name: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  description: z.string().max(500).optional(),
  memoryMb: z.number().int().min(16).max(512).optional(),
  timeoutMs: z.number().int().min(100).max(60_000).optional(),
  env: z.record(z.string()).optional()
});

export const GET = withCors(
  "admin-only",
  defineRoute({
    handler: async (_input, { params }) => {
      const ctx = await requireAppAccess(String(params.appId));
      const items = await FunctionsService.listForApp(ctx.app.id);
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
      const fn = await FunctionsService.create({
        appId: ctx.app.id,
        name: body.name,
        description: body.description,
        memoryMb: body.memoryMb,
        timeoutMs: body.timeoutMs,
        env: body.env,
        createdById: ctx.user.id
      });
      return { fn };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
