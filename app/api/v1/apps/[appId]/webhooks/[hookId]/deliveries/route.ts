import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { WebhooksService } from "@/modules/webhooks";

const params = z.object({ appId: idSchema, hookId: idSchema });

export const GET = withCors(
  "admin-only",
  defineRoute({
    schema: { params },
    handler: async ({ params: p }) => {
      const ctx = await requireAppAccess(p.appId);
      const items = await WebhooksService.listDeliveries(ctx.app.id, p.hookId, 50);
      return { items };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
