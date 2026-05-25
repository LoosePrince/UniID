import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { WebhooksService } from "@/modules/webhooks";

const params = z.object({ appId: idSchema, hookId: idSchema, deliveryId: idSchema });

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { params },
    handler: async ({ params: p }) => {
      const ctx = await requireAppAccess(p.appId);
      await WebhooksService.retryDeliveryForHook(ctx.app.id, p.hookId, p.deliveryId);
      return { success: true };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));