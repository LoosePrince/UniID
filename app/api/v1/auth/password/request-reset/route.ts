import { z } from "zod";
import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { AuthService } from "@/modules/auth";

const bodySchema = z.object({
  identifier: z.string().trim().min(1).max(320)
});

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { body: bodySchema },
    handler: async ({ body }, { req }) => {
      const result = await AuthService.createPasswordReset(body.identifier, req.nextUrl.origin);
      return {
        ...(process.env.NODE_ENV !== "production" ? result : { sent: result.sent, resetUrl: result.resetUrl })
      };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
