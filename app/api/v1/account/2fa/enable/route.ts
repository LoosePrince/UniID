import { z } from "zod";
import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireConsoleAuth } from "@/shared/iam";
import { AuthService } from "@/modules/auth";

const bodySchema = z.object({
  secret: z.string().trim().min(16).max(64),
  code: z.string().trim().regex(/^\d{6}$/)
});

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { body: bodySchema },
    handler: async ({ body }) => {
      const auth = await requireConsoleAuth();
      await AuthService.enableTwoFactor(auth.user.id, body.secret, body.code);
      return { success: true };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
