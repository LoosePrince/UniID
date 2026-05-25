import { z } from "zod";
import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { AppService } from "@/modules/apps";

const createSchema = z.object({
  host: z.string().min(1).max(255)
});

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { body: createSchema },
    handler: async ({ body }, { params }) => {
      const ctx = await requireAppAccess(String(params.appId));
      const domain = await AppService.addDomain(ctx.app.id, ctx.user.id, body.host);
      return { domain };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
