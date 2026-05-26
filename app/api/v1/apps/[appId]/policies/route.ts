import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { PolicyAdminService, policyUpsertInputSchema } from "@/modules/policies";

const params = z.object({ appId: idSchema });

export const GET = withCors(
  "admin-only",
  defineRoute({
    schema: { params },
    handler: async ({ params: p }) => {
      const auth = await requireAppAccess(p.appId);
      const policies = await PolicyAdminService.list(auth.app.id);
      return { policies };
    }
  })
);

export const PUT = withCors(
  "admin-only",
  defineRoute({
    schema: { params, body: policyUpsertInputSchema },
    handler: async ({ params: p, body }) => {
      const auth = await requireAppAccess(p.appId);
      return PolicyAdminService.upsert(auth.app.id, body, auth.user.id);
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));