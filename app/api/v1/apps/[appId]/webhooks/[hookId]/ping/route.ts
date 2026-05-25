import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { WebhooksService } from "@/modules/webhooks";

export const POST = withCors(
  "admin-only",
  defineRoute({
    handler: async (_input, { params }) => {
      await requireAppAccess(String(params.appId));
      const result = await WebhooksService.ping(String(params.hookId));
      return result;
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
