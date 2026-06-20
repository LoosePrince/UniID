import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { AppDatabaseService } from "@/modules/app-databases";

const params = z.object({ appId: idSchema, databaseId: idSchema });
const bodySchema = z.object({ keyId: idSchema });

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { params, body: bodySchema },
    handler: async ({ params: p, body }) => {
      const ctx = await requireAppAccess(p.appId);
      return {
        key: await AppDatabaseService.revokeKey({
          appId: ctx.app.id,
          databaseId: p.databaseId,
          keyId: body.keyId,
          actorUserId: ctx.user.id
        })
      };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));

