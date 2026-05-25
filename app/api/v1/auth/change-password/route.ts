import { z } from "zod";
import { defineRoute, passwordSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireConsoleAuth } from "@/shared/iam";
import { AuthService } from "@/modules/auth";

const bodySchema = z.object({
  oldPassword: passwordSchema,
  newPassword: passwordSchema
});

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { body: bodySchema },
    handler: async ({ body }) => {
      const auth = await requireConsoleAuth();
      await AuthService.changePassword(auth.user.id, body.oldPassword, body.newPassword);
      return { success: true };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
