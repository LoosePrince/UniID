import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { AppDatabaseService } from "@/modules/app-databases";

const params = z.object({
  appId: idSchema,
  databaseId: idSchema,
  table: z.string().min(1).max(80)
});
const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional()
});
const bodySchema = z.object({ data: z.record(z.unknown()) });

export const GET = withCors(
  "admin-only",
  defineRoute({
    schema: { params, query: querySchema },
    handler: async ({ params: p, query }) => {
      const ctx = await requireAppAccess(p.appId);
      return AppDatabaseService.listRows({
        appId: ctx.app.id,
        databaseId: p.databaseId,
        table: p.table,
        limit: query?.limit,
        offset: query?.offset
      });
    }
  })
);

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { params, body: bodySchema },
    handler: async ({ params: p, body }) => {
      const ctx = await requireAppAccess(p.appId);
      return AppDatabaseService.insertRow({
        appId: ctx.app.id,
        databaseId: p.databaseId,
        table: p.table,
        data: body.data,
        actorUserId: ctx.user.id
      });
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));

