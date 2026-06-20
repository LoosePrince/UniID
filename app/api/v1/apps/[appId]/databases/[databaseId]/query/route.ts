import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { AppDatabaseService } from "@/modules/app-databases";

const params = z.object({ appId: idSchema, databaseId: idSchema });
const bodySchema = z.object({
  sql: z.string().min(1).max(200_000),
  params: z.union([z.array(z.unknown()), z.record(z.unknown())]).optional(),
  mode: z.enum(["auto", "read", "write"]).optional()
});

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { params, body: bodySchema },
    handler: async ({ params: p, body }) => {
      const ctx = await requireAppAccess(p.appId);
      return AppDatabaseService.executeQuery({
        appId: ctx.app.id,
        databaseId: p.databaseId,
        sql: body.sql,
        params: body.params,
        mode: body.mode,
        actorUserId: ctx.user.id
      });
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));

