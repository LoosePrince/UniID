import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { AppDatabaseService } from "@/modules/app-databases";

const params = z.object({ appId: idSchema, databaseId: idSchema });
const bodySchema = z.object({
  keyId: idSchema.optional(),
  label: z.string().min(1).max(80).optional()
});

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { params, body: bodySchema },
    handler: async ({ params: p, body }) => {
      const ctx = await requireAppAccess(p.appId);
      return AppDatabaseService.rotateKey({
        appId: ctx.app.id,
        databaseId: p.databaseId,
        keyId: body.keyId,
        label: body.label,
        actorUserId: ctx.user.id
      });
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));

