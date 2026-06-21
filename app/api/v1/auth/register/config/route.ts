import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { AuthService } from "@/modules/auth";

export const GET = withCors(
  "admin-only",
  defineRoute({
    handler: async () => AuthService.getRegistrationConfig()
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
