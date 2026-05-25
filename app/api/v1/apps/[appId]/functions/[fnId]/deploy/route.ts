import { z } from "zod";
import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { FunctionsService } from "@/modules/functions";

const bodySchema = z.object({
  sourceCode: z.string().min(1).max(256 * 1024)
});

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { body: bodySchema },
    handler: async ({ body }, { params }) => {
      const ctx = await requireAppAccess(String(params.appId));
      await FunctionsService.getForApp(ctx.app.id, String(params.fnId));
      const dep = await FunctionsService.deploy({
        fnId: String(params.fnId),
        sourceCode: body.sourceCode,
        deployedById: ctx.user.id
      });
      return { deployment: dep };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
