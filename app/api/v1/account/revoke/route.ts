/**
 * POST /api/v1/account/revoke
 *
 * 控制台 cookie 鉴权：用户主动撤销某个 App 的授权。
 */
import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireConsoleAuth } from "@/shared/iam";
import { AuthService } from "@/modules/auth";

const bodySchema = z.object({ app_id: idSchema });

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { body: bodySchema },
    handler: async ({ body }) => {
      const auth = await requireConsoleAuth();
      await AuthService.revoke(auth.user.id, body.app_id);
      return { success: true };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
