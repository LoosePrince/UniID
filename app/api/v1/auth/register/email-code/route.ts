import { z } from "zod";
import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { AuthService } from "@/modules/auth";

const bodySchema = z.object({
  email: z.string().trim().email()
});

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { body: bodySchema },
    handler: async ({ body }) => {
      const result = await AuthService.requestRegistrationEmailCode(body.email);
      return {
        sent: result.sent,
        challenge: result.challenge,
        expiresIn: result.expiresIn,
        ...(process.env.NODE_ENV !== "production" ? { code: result.code } : {})
      };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
