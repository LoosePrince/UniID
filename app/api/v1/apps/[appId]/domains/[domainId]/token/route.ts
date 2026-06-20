import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { AppService } from "@/modules/apps";

const params = z.object({ appId: idSchema, domainId: idSchema });

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { params },
    handler: async ({ params: p }) => {
      const ctx = await requireAppAccess(p.appId);
      const domain = await AppService.refreshDomainVerifyToken(ctx.app.id, ctx.user.id, p.domainId);
      return {
        domain,
        verification: AppService.domainVerificationRecord(domain.host, domain.verifyToken)
      };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
