import { z } from "zod";
import { defineRoute, passwordSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { AuthService } from "@/modules/auth";

const bodySchema = z.object({
  token: z.string().min(16),
  newPassword: passwordSchema
});

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { body: bodySchema },
    handler: async ({ body }) => {
      await AuthService.resetPassword(body.token, body.newPassword);
      return { success: true };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
