import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { FunctionsService } from "@/modules/functions";

const params = z.object({ appId: idSchema, fnId: idSchema });
const body = z.object({ payload: z.unknown().optional() });

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { params, body },
    handler: async ({ params: p, body }) => {
      const ctx = await requireAppAccess(p.appId);
      await FunctionsService.getForApp(ctx.app.id, p.fnId);
      const result = await FunctionsService.invoke({
        appId: ctx.app.id,
        fnIdOrName: p.fnId,
        payload: body.payload,
        trigger: "http"
      });
      return result;
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));