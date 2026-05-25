import { z } from "zod";
import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess, requireSystemAdmin } from "@/shared/iam";
import { AppService } from "@/modules/apps";

const createSchema = z.object({
  host: z.string().min(1).max(255)
});

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { body: createSchema },
    handler: async ({ body }, { params }) => {
      await requireSystemAdmin();
      const ctx = await requireAppAccess(String(params.appId));
      const domain = await AppService.addDomain(ctx.app.id, ctx.user.id, body.host, ctx.user.role);
      return { domain };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
