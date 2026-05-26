import { z } from "zod";
import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireSystemAdmin } from "@/shared/iam";
import { AdminService } from "@/modules/admin";

const keySchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9_.:-]+$/, "validation.configKey");

const body = z.object({
  key: keySchema,
  value: z.unknown()
});

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { body },
    handler: async ({ body }) => {
      const ctx = await requireSystemAdmin();
      await AdminService.setConfig(ctx.user.id, body.key, body.value);
      return { ok: true };
    }
  })
);

export const PUT = withCors(
  "admin-only",
  defineRoute({
    schema: { body },
    handler: async ({ body }) => {
      const ctx = await requireSystemAdmin();
      await AdminService.setConfig(ctx.user.id, body.key, body.value);
      return { ok: true };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));