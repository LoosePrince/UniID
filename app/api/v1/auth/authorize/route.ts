/**
 * POST /api/v1/auth/authorize
 *
 * 仅允许同源（embed/控制台）调用；从可信 cookie 取当前 UniID 用户，
 * 校验 parent_origin 与 app.domain 匹配后，颁发 (user × app) 的 access + refresh。
 */
import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { ApiError } from "@/shared/errors";
import { requireUserSession } from "@/shared/iam";
import { AuthService } from "@/modules/auth";
import { prisma } from "@/shared/prisma";

const bodySchema = z.object({
  app_id: idSchema,
  auth_type: z.enum(["full", "restricted"]).default("restricted"),
  parent_origin: z.string().url(),
  scope: z.unknown().optional()
});

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { body: bodySchema },
    handler: async ({ body }, { req }) => {
      const session = await requireUserSession();

      const parentHost = new URL(body.parent_origin).host;
      const app = await prisma.app.findUnique({
        where: { id: body.app_id },
        include: { domains: true }
      });
      if (!app) throw new ApiError("APP_NOT_FOUND");

      const matched =
        app.primaryDomain === parentHost ||
        app.domains.some((d) => d.verified === 1 && d.host === parentHost);
      if (!matched) {
        throw new ApiError("AUTH_PARENT_ORIGIN_MISMATCH", {
          details: { registered: app.primaryDomain, got: parentHost }
        });
      }

      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
      const ua = req.headers.get("user-agent");

      const result = await AuthService.authorize({
        userId: session.userId,
        appId: body.app_id,
        authType: body.auth_type,
        scope: body.scope,
        ip,
        userAgent: ua
      });

      return {
        token: result.accessToken,
        refresh_token: result.refreshToken,
        expires_in: result.expiresIn,
        user: result.user,
        app_id: result.app.id,
        app_name: result.app.name,
        auth_type: result.authType
      };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
