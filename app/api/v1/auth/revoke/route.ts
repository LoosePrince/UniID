import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireSdkAuth } from "@/shared/iam";
import { AuthService } from "@/modules/auth";

export const POST = withCors(
  "app-domain",
  defineRoute({
    handler: async (_input, { req }) => {
      const auth = await requireSdkAuth(req);
      await AuthService.revoke(auth.user.id, auth.app.id);
      return {
        success: true,
        app_id: auth.app.id,
        revoked_at: Math.floor(Date.now() / 1000)
      };
    }
  })
);

export const OPTIONS = withCors("app-domain", async () => new Response(null, { status: 204 }));
