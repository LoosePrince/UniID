import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { PolicyAdminService, policyExplainInputSchema } from "@/modules/policies";

const params = z.object({ appId: idSchema });

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { params, body: policyExplainInputSchema },
    handler: async ({ params: p, body }) => {
      const auth = await requireAppAccess(p.appId);
      return PolicyAdminService.explain(auth.app.id, body);
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));