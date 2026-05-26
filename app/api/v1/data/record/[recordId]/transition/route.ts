/**
 * POST /api/v1/data/record/[recordId]/transition
 *
 * 执行 Workflow 状态流转。请求体使用 patch 语义，默认与当前记录合并。
 */
import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireSdkAuth } from "@/shared/iam";
import { DataService, RecordRepository } from "@/modules/data";
import { ApiError } from "@/shared/errors";
import { prisma } from "@/shared/prisma";
import type { AuthContext } from "@/shared/policy";

const params = z.object({ recordId: idSchema });

const body = z
  .object({
    transition: z.string().min(1).optional(),
    action: z.string().min(1).optional(),
    data: z.record(z.unknown()).optional(),
    metadata: z.record(z.unknown()).optional(),
    merge: z.boolean().optional()
  })
  .refine((value) => Boolean(value.transition ?? value.action), {
    message: "transition or action is required",
    path: ["transition"]
  });

export const POST = withCors(
  "app-domain",
  defineRoute({
    schema: { params, body },
    handler: async ({ params: p, body: b }, { req }) => {
      const existing = await RecordRepository.findById(p.recordId);
      if (!existing) throw new ApiError("DATA_RECORD_NOT_FOUND");
      const auth = await requireSdkAuth(req as never);
      if (auth.app.id !== existing.appId) throw new ApiError("APP_ORIGIN_MISMATCH");
      const app = await prisma.app.findUnique({
        where: { id: existing.appId },
        include: { admins: true }
      });
      const actor: AuthContext = {
        userId: auth.user.id,
        role: auth.user.role,
        systemAdmin: auth.user.role === "admin",
        appAdmin:
          !!app && (app.ownerId === auth.user.id || app.admins.some((admin) => admin.userId === auth.user.id)),
        appId: existing.appId,
        authType: auth.session.authType,
        ownerId: existing.ownerId,
        origin: "sdk"
      };
      const record = await DataService.transition(
        {
          appId: existing.appId,
          dataType: existing.dataType,
          recordId: existing.id,
          transition: b.transition ?? b.action!,
          data: b.data ?? {},
          metadata: b.metadata,
          merge: b.merge ?? true
        },
        { actor }
      );
      return { record };
    }
  })
);

export const OPTIONS = withCors("app-domain", async () => new Response(null, { status: 204 }));