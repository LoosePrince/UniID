import { z } from "zod";
import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireConsoleAuth } from "@/shared/iam";
import { AuthService } from "@/modules/auth";

const bodySchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/)
});

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { body: bodySchema },
    handler: async ({ body }) => {
      const auth = await requireConsoleAuth();
      await AuthService.disableTwoFactor(auth.user.id, body.code);
      return { success: true };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
