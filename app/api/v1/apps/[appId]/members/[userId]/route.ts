import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { AppService } from "@/modules/apps";

export const DELETE = withCors(
  "admin-only",
  defineRoute({
    handler: async (_input, { params }) => {
      const ctx = await requireAppAccess(String(params.appId));
      await AppService.removeAdmin(ctx.app.id, ctx.user.id, String(params.userId));
      return { success: true };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
