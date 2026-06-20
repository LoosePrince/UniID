import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { AppService } from "@/modules/apps";

const params = z.object({ appId: idSchema });
const createSchema = z.object({
  label: z.string().min(1).max(80),
  scopes: z.array(z.string().min(1).max(80)).max(50).optional()
});

export const GET = withCors(
  "admin-only",
  defineRoute({
    schema: { params },
    handler: async ({ params: p }) => {
      const ctx = await requireAppAccess(p.appId);
      const items = await AppService.listApiKeys(ctx.app.id);
      return { items };
    }
  })
);

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { params, body: createSchema },
    handler: async ({ params: p, body }) => {
      const ctx = await requireAppAccess(p.appId);
      const result = await AppService.createApiKey({
        appId: ctx.app.id,
        label: body.label,
        scopes: body.scopes,
        createdById: ctx.user.id,
        actorRole: ctx.user.role
      });
      return result;
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
