import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess, requireSystemAdmin } from "@/shared/iam";
import { AppService } from "@/modules/apps";

export const DELETE = withCors(
  "admin-only",
  defineRoute({
    handler: async (_input, { params }) => {
      await requireSystemAdmin();
      const ctx = await requireAppAccess(String(params.appId));
      await AppService.deleteDomain(ctx.app.id, ctx.user.id, String(params.domainId), ctx.user.role);
      return { success: true };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
