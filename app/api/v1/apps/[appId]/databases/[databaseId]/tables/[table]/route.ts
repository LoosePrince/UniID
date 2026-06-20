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

export const GET = withCors(
  "admin-only",
  defineRoute({
    schema: { params },
    handler: async ({ params: p }) => {
      const ctx = await requireAppAccess(p.appId);
      return AppDatabaseService.tableDetail(ctx.app.id, p.databaseId, p.table);
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));

