import { z } from "zod";
import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireSystemAdmin } from "@/shared/iam";
import { AdminService } from "@/modules/admin";

const body = z.object({
  userId: z.string().min(1),
  role: z.enum(["user", "admin"])
});

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { body },
    handler: async ({ body }) => {
      const ctx = await requireSystemAdmin();
      await AdminService.setRole(ctx.user.id, body.userId, body.role);
      return { ok: true };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
