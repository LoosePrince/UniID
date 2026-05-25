import { z } from "zod";
import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireSystemAdmin } from "@/shared/iam";
import { AdminService } from "@/modules/admin";

const body = z.object({
  rpsLimit: z.number().int().min(1).max(100_000).optional(),
  dailyApiCalls: z.number().int().min(1).optional(),
  monthlyStorageBytes: z.number().int().min(1).optional(),
  fnInvocationsDaily: z.number().int().min(1).optional()
});

export const PUT = withCors(
  "admin-only",
  defineRoute({
    schema: { body },
    handler: async ({ body }) => {
      const ctx = await requireSystemAdmin();
      const merged = await AdminService.setDefaultQuota(ctx.user.id, body);
      return { quota: merged };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
