import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { WorkflowService, workflowUpsertInputSchema } from "@/modules/workflows";

const params = z.object({ appId: idSchema });

export const GET = withCors(
  "admin-only",
  defineRoute({
    schema: { params },
    handler: async ({ params: p }) => {
      const auth = await requireAppAccess(p.appId);
      const workflows = await WorkflowService.list(auth.app.id);
      return { workflows };
    }
  })
);

export const PUT = withCors(
  "admin-only",
  defineRoute({
    schema: { params, body: workflowUpsertInputSchema },
    handler: async ({ params: p, body }) => {
      const auth = await requireAppAccess(p.appId);
      return WorkflowService.upsert(auth.app.id, body, auth.user.id);
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));