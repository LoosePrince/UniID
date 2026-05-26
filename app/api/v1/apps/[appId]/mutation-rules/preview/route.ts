import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { MutationRuleService, mutationRulePreviewInputSchema } from "@/modules/mutation-rules";

const params = z.object({ appId: idSchema });

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { params, body: mutationRulePreviewInputSchema },
    handler: async ({ params: p, body }) => {
      const auth = await requireAppAccess(p.appId);
      return MutationRuleService.preview(auth.app.id, body);
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));