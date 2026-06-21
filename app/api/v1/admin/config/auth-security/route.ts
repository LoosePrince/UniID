import { z } from "zod";
import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireSystemAdmin } from "@/shared/iam";
import { AdminService } from "@/modules/admin";

const body = z.object({
  emailVerificationEnabled: z.boolean().optional(),
  twoFactorEnabled: z.boolean().optional()
});

export const PUT = withCors(
  "admin-only",
  defineRoute({
    schema: { body },
    handler: async ({ body }) => {
      const ctx = await requireSystemAdmin();
      const config = await AdminService.setAuthSecurityConfig(ctx.user.id, body);
      return { config };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
