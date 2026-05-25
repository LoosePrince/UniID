import { z } from "zod";
import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { WebhooksService } from "@/modules/webhooks";

const createSchema = z.object({
  name: z.string().min(1).max(64),
  url: z.string().url(),
  events: z.array(z.string().min(1)).min(1).max(20)
});

export const GET = withCors(
  "admin-only",
  defineRoute({
    handler: async (_input, { params }) => {
      const ctx = await requireAppAccess(String(params.appId));
      const items = await WebhooksService.listForApp(ctx.app.id);
      return { items };
    }
  })
);

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { body: createSchema },
    handler: async ({ body }, { params }) => {
      const ctx = await requireAppAccess(String(params.appId));
      const hook = await WebhooksService.create({
        appId: ctx.app.id,
        name: body.name,
        url: body.url,
        events: body.events,
        createdById: ctx.user.id
      });
      return { hook };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
