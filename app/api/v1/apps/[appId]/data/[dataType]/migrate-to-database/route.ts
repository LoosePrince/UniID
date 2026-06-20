import { z } from "zod";
import { defineRoute, dataTypeSchema, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { AppDatabaseService } from "@/modules/app-databases";

const params = z.object({ appId: idSchema, dataType: dataTypeSchema });
const bodySchema = z.object({
  databaseId: idSchema,
  tableName: z.string().min(1).max(80).optional()
});

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { params, body: bodySchema },
    handler: async ({ params: p, body }) => {
      const ctx = await requireAppAccess(p.appId);
      return AppDatabaseService.migrateDataTypeToDatabase({
        appId: ctx.app.id,
        dataType: p.dataType,
        databaseId: body.databaseId,
        tableName: body.tableName,
        actorUserId: ctx.user.id
      });
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));

