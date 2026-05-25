import { z } from "zod";
import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { AppService } from "@/modules/apps";

const addSchema = z.object({
  username: z.string().min(1).max(64)
});

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { body: addSchema },
    handler: async ({ body }, { params }) => {
      const ctx = await requireAppAccess(String(params.appId));
      const member = await AppService.addAdmin(ctx.app.id, ctx.user.id, body.username);
      return { member };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
