import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireSystemAdmin } from "@/shared/iam";
import { AdminService } from "@/modules/admin";

const body = z.object({
  appId: idSchema,
  status: z.enum(["active", "suspended", "archived"])
});

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { body },
    handler: async ({ body }) => {
      const ctx = await requireSystemAdmin();
      await AdminService.setAppStatus(ctx.user.id, body.appId, body.status);
      return { ok: true };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
