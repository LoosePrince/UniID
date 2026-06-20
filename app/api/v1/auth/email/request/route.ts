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
        ...(process.env.NODE_ENV !== "production" ? result : { verifyUrl: result.verifyUrl })
      };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
