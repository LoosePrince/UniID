import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { AppDatabaseService } from "@/modules/app-databases";

const params = z.object({
  appId: idSchema,
  databaseId: idSchema,
  table: z.string().min(1).max(80),
  rowid: z.coerce.number().int().positive()
});
const bodySchema = z.object({ data: z.record(z.unknown()) });

export const PATCH = withCors(
  "admin-only",
  defineRoute({
    schema: { params, body: bodySchema },
    handler: async ({ params: p, body }) => {
      const ctx = await requireAppAccess(p.appId);
      return AppDatabaseService.updateRow({
        appId: ctx.app.id,
        databaseId: p.databaseId,
        table: p.table,
        rowid: p.rowid,
        data: body.data,
        actorUserId: ctx.user.id
      });
    }
  })
);

export const DELETE = withCors(
  "admin-only",
  defineRoute({
    schema: { params },
    handler: async ({ params: p }) => {
      const ctx = await requireAppAccess(p.appId);
      return AppDatabaseService.deleteRow({
        appId: ctx.app.id,
        databaseId: p.databaseId,
        table: p.table,
        rowid: p.rowid,
        actorUserId: ctx.user.id
      });
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));

