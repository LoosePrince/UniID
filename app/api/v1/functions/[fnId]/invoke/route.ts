/**
 * POST /api/v1/functions/[fnId]/invoke
 *
 * 调用函数（SDK 触发）。
 */
import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireSdkAuth } from "@/shared/iam";
import { FunctionsService } from "@/modules/functions";

const params = z.object({ fnId: z.string().min(1).max(128) });
const body = z.object({ payload: z.unknown().optional() });

export const POST = withCors(
  "app-domain",
  defineRoute({
    schema: { params, body },
    handler: async ({ params: p, body }, { req }) => {
      const auth = await requireSdkAuth(req as never);
      const result = await FunctionsService.invoke({
        appId: auth.app.id,
        fnIdOrName: p.fnId,
        payload: body?.payload,
        trigger: "sdk"
      });
      return result;
    }
  })
);

export const OPTIONS = withCors("app-domain", async () => new Response(null, { status: 204 }));
