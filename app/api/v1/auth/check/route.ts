/**
 * GET /api/v1/auth/check?app_id=...
 *
 * 同源（控制台 / embed 自身）：返回当前 UniID 用户会话。
 * 跨域（带 app_id，且 Origin ∈ app.domains）：返回 token 描述的 (user × app) 授权状态。
 *
 * 用于：embed 决定是否需要跳登录页；SDK 判断 token 是否仍可用。
 */
import { z } from "zod";
import { defineRoute, idSchema, json } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { getCurrentUserSession, verifyAppAccessToken } from "@/shared/iam";
import { prisma } from "@/shared/prisma";

const querySchema = z.object({
  app_id: idSchema.optional()
});

export const GET = withCors(
  "app-or-admin",
  defineRoute({
    schema: { query: querySchema },
    handler: async ({ query }, { req }) => {
      const appId = query?.app_id;
      const authHeader = req.headers.get("authorization");
      const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

      // 优先：跨域 Bearer token（SDK 调）
      if (bearer && appId) {
        try {
          const payload = await verifyAppAccessToken(bearer);
          if (payload.app_id !== appId) {
            return json({ valid: false, reason: "token_app_mismatch" });
          }
          const [user, app, authz] = await Promise.all([
            prisma.user.findUnique({ where: { id: payload.sub } }),
            prisma.app.findUnique({ where: { id: appId } }),
            prisma.authorization.findUnique({
              where: { userId_appId: { userId: payload.sub, appId } }
            })
          ]);
          if (!user || !app) return json({ valid: false, reason: "not_found" });
          if (!authz || authz.revokedAt) return json({ valid: false, reason: "revoked" });
          if (authz.expiresAt && authz.expiresAt <= Math.floor(Date.now() / 1000)) {
            return json({ valid: false, reason: "expired" });
          }
          return json({
            valid: true,
            user: { id: user.id, username: user.username, role: user.role },
            app: { id: app.id, name: app.name, primaryDomain: app.primaryDomain },
            authType: authz.authType
          });
        } catch {
          return json({ valid: false, reason: "invalid_token" });
        }
      }

      // 同源/Embed：UniID 自身会话
      const session = await getCurrentUserSession();
      if (!session) {
        // 顺便附带应用信息（如果 app_id 有效），便于 embed 渲染应用卡片
        let app = null;
        if (appId) {
          const a = await prisma.app.findUnique({ where: { id: appId } });
          if (a) app = { id: a.id, name: a.name, description: a.description, primaryDomain: a.primaryDomain };
        }
        return json({ valid: false, app });
      }
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { id: true, username: true, role: true, displayName: true, email: true }
      });
      let app = null;
      if (appId) {
        const a = await prisma.app.findUnique({ where: { id: appId } });
        if (a) app = { id: a.id, name: a.name, description: a.description, primaryDomain: a.primaryDomain };
      }
      return json({ valid: true, user, app });
    }
  })
);

export const OPTIONS = withCors("app-or-admin", async () => new Response(null, { status: 204 }));
