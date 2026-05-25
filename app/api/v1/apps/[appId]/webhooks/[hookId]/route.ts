import { z } from "zod";
import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { WebhooksService } from "@/modules/webhooks";

const patchSchema = z.object({
  isActive: z.boolean().optional(),
  rotateSecret: z.boolean().optional()
});

export const PATCH = withCors(
  "admin-only",
  defineRoute({
    schema: { body: patchSchema },
    handler: async ({ body }, { params }) => {
      await requireAppAccess(String(params.appId));
      const hookId = String(params.hookId);
      let hook;
      if (body.isActive !== undefined) {
        hook = await WebhooksService.setActive(hookId, body.isActive);
      }
      if (body.rotateSecret) {
        hook = await WebhooksService.rotateSecret(hookId);
      }
      return { hook };
    }
  })
);

export const DELETE = withCors(
  "admin-only",
  defineRoute({
    handler: async (_input, { params }) => {
      await requireAppAccess(String(params.appId));
      await WebhooksService.deleteOne(String(params.hookId));
      return { success: true };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
