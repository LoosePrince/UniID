import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireConsoleAuth } from "@/shared/iam";
import { AuthService } from "@/modules/auth";

export const POST = withCors(
  "admin-only",
  defineRoute({
    handler: async () => {
      const auth = await requireConsoleAuth();
      return AuthService.beginTwoFactorSetup(auth.user.id);
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
