import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireConsoleAuth } from "@/shared/iam";
import { AuthService } from "@/modules/auth";

export const POST = withCors(
  "admin-only",
  defineRoute({
    handler: async (_input, { req }) => {
      const auth = await requireConsoleAuth();
      const result = await AuthService.createEmailVerification(auth.user.id, req.nextUrl.origin);
      return {
        success: true,
        sent: result.sent,
        ...(process.env.NODE_ENV !== "production" ? { verifyUrl: result.verifyUrl } : {})
      };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
