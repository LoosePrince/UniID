import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { AppDatabaseService } from "@/modules/app-databases";

const params = z.object({ appId: idSchema, databaseId: idSchema });
const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  note: z.string().max(500).nullable().optional(),
  status: z.enum(["active", "disabled"]).optional()
});

export const GET = withCors(
  "admin-only",
  defineRoute({
    schema: { params },
    handler: async ({ params: p }) => {
      const ctx = await requireAppAccess(p.appId);
      return { database: await AppDatabaseService.get(ctx.app.id, p.databaseId) };
    }
  })
);

export const PATCH = withCors(
  "admin-only",
  defineRoute({
    schema: { params, body: patchSchema },
    handler: async ({ params: p, body }) => {
      const ctx = await requireAppAccess(p.appId);
      return {
        database: await AppDatabaseService.update({
          appId: ctx.app.id,
          databaseId: p.databaseId,
          actorUserId: ctx.user.id,
          ...body
        })
      };
    }
  })
);

export const DELETE = withCors(
  "admin-only",
  defineRoute({
    schema: { params },
    handler: async ({ params: p }) => {
      const ctx = await requireAppAccess(p.appId);
      return { database: await AppDatabaseService.softDelete(ctx.app.id, p.databaseId, ctx.user.id) };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));

