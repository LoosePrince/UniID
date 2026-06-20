import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { AppDatabaseService } from "@/modules/app-databases";

const params = z.object({ appId: idSchema });
const createSchema = z.object({
  name: z.string().min(1).max(80),
  note: z.string().max(500).optional(),
  createKey: z.boolean().optional(),
  keyLabel: z.string().min(1).max(80).optional()
});

export const GET = withCors(
  "admin-only",
  defineRoute({
    schema: { params },
    handler: async ({ params: p }) => {
      const ctx = await requireAppAccess(p.appId);
      return { items: await AppDatabaseService.list(ctx.app.id) };
    }
  })
);

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { params, body: createSchema },
    handler: async ({ params: p, body }) => {
      const ctx = await requireAppAccess(p.appId);
      return AppDatabaseService.create({
        appId: ctx.app.id,
        name: body.name,
        note: body.note,
        createKey: body.createKey,
        keyLabel: body.keyLabel,
        createdById: ctx.user.id
      });
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));

