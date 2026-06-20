import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { AuditService } from "@/shared/audit";

const params = z.object({ appId: idSchema });
const query = z.object({
  userId: z.string().optional(),
  action: z.string().optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  q: z.string().optional(),
  from: z.coerce.number().int().positive().optional(),
  to: z.coerce.number().int().positive().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
});

export const GET = withCors(
  "admin-only",
  defineRoute({
    schema: { params, query },
    handler: async ({ params: p, query: q }) => {
      await requireAppAccess(p.appId);
      const rows = await AuditService.list({
        appId: p.appId,
        userId: q?.userId || undefined,
        action: q?.action || undefined,
        resourceType: q?.resourceType || undefined,
        resourceId: q?.resourceId || undefined,
        query: q?.q || undefined,
        from: q?.from,
        to: q?.to,
        cursor: q?.cursor || undefined,
        limit: q?.limit ?? 50
      });
      return {
        logs: rows,
        nextCursor: rows.length === (q?.limit ?? 50) ? rows[rows.length - 1]?.id ?? null : null
      };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
