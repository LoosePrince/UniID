import { z } from "zod";
import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess, requireSystemAdmin } from "@/shared/iam";
import { AppService } from "@/modules/apps";

const createSchema = z.object({
  host: z.string().min(1).max(255)
});

export const GET = withCors(
  "admin-only",
  defineRoute({
    handler: async (_input, { params }) => {
      const ctx = await requireAppAccess(String(params.appId));
      const app = await AppService.get(ctx.app.id);
      return {
        items: app.domains.map((domain: { id: string; host: string; verified: number; verifyToken: string | null; createdAt: number }) => ({
          id: domain.id,
          host: domain.host,
          verified: domain.verified === 1,
          verifyToken: domain.verifyToken,
          createdAt: domain.createdAt,
          verification: AppService.domainVerificationRecord(domain.host, domain.verifyToken)
        }))
      };
    }
  })
);

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { body: createSchema },
    handler: async ({ body }, { params }) => {
      await requireSystemAdmin();
      const ctx = await requireAppAccess(String(params.appId));
      const domain = await AppService.addDomain(ctx.app.id, ctx.user.id, body.host, ctx.user.role);
      return {
        domain,
        verification: AppService.domainVerificationRecord(domain.host, domain.verifyToken)
      };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
