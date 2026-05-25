import { z } from "zod";
import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireSystemAdmin } from "@/shared/iam";
import { AdminService } from "@/modules/admin";

const body = z.object({
  userId: z.string().min(1),
  username: z.string().trim().min(1).max(64).optional(),
  email: z.string().trim().email().nullable().optional(),
  displayName: z.string().trim().max(80).nullable().optional(),
  locale: z.string().trim().min(2).max(16).optional()
});

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { body },
    handler: async ({ body }) => {
      const ctx = await requireSystemAdmin();
      await AdminService.updateUser(ctx.user.id, body.userId, {
        username: body.username,
        email: body.email,
        displayName: body.displayName,
        locale: body.locale
      });
      return { ok: true };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));