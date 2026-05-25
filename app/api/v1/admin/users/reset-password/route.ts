import { z } from "zod";
import { defineRoute, passwordSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireSystemAdmin } from "@/shared/iam";
import { AdminService } from "@/modules/admin";

const body = z.object({
  userId: z.string().min(1),
  newPassword: passwordSchema
});

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { body },
    handler: async ({ body }) => {
      const ctx = await requireSystemAdmin();
      await AdminService.resetPassword(ctx.user.id, body.userId, body.newPassword);
      return { ok: true };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
