/**
 * GET    /api/v1/apps/[appId]/settings  → 当前应用配置
 * PATCH  /api/v1/apps/[appId]/settings  → 更新名称/描述/状态/主域名
 * DELETE /api/v1/apps/[appId]/settings  → 危险：删除应用
 */
import { z } from "zod";
import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { AppService } from "@/modules/apps";
import { QuotaService } from "@/shared/quota";

const patchSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  description: z.string().max(500).optional(),
  primaryDomain: z.string().min(1).max(255).optional(),
  status: z.enum(["active", "suspended", "archived"]).optional(),
  quota: z
    .object({
      rpsLimit: z.number().int().min(1).max(10_000).optional(),
      dailyApiCalls: z.number().int().min(1).optional(),
      monthlyStorageBytes: z.number().int().min(0).optional(),
      monthlyEgressBytes: z.number().int().min(0).optional(),
      fnInvocationsDaily: z.number().int().min(0).optional()
    })
    .optional()
});

export const GET = withCors(
  "admin-only",
  defineRoute({
    handler: async (_input, { params }) => {
      const ctx = await requireAppAccess(String(params.appId));
      const app = await AppService.get(ctx.app.id);
      const quota = await QuotaService.getOrDefault(ctx.app.id);
      return {
        app: {
          id: app.id,
          name: app.name,
          description: app.description,
          primaryDomain: app.primaryDomain,
          status: app.status,
          ownerId: app.ownerId,
          owner: app.owner ? { id: app.owner.id, username: app.owner.username } : null,
          createdAt: app.createdAt,
          domains: app.domains.map((d: { id: string; host: string; verified: number }) => ({
            id: d.id,
            host: d.host,
            verified: d.verified === 1
          })),
          admins: app.admins.map((a: { user: { id: string; username: string } }) => ({
            id: a.user.id,
            username: a.user.username
          }))
        },
        quota
      };
    }
  })
);

export const PATCH = withCors(
  "admin-only",
  defineRoute({
    schema: { body: patchSchema },
    handler: async ({ body }, { params }) => {
      const ctx = await requireAppAccess(String(params.appId));
      const { quota, ...appPatch } = body;
      if (Object.keys(appPatch).length > 0) {
        await AppService.update(ctx.app.id, ctx.user.id, appPatch);
      }
      if (quota) {
        await QuotaService.update(ctx.app.id, quota);
      }
      return { success: true };
    }
  })
);

export const DELETE = withCors(
  "admin-only",
  defineRoute({
    handler: async (_input, { params }) => {
      const ctx = await requireAppAccess(String(params.appId));
      await AppService.destroy(ctx.app.id, ctx.user.id);
      return { success: true };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
