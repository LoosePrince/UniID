/**
 * POST /api/v1/data/record/[recordId]/ops
 *
 * 原子字段操作（事务内 read-modify-write）。
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

// 注意：`z.unknown()` 默认会推断成 optional（key?: unknown）。
// 服务端要求 push/set 必填 value，所以用 `z.any().refine(...)` 排除 undefined。
const requiredAny = z.any().refine((v) => v !== undefined, { message: "value 必填" });

const incomingOpSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("increment"), path: z.string(), value: z.number().optional() }),
  z.object({ type: z.literal("push"), path: z.string(), value: requiredAny, uniq: z.boolean().optional() }),
  z.object({ type: z.literal("set"), path: z.string(), value: requiredAny }),
  z.object({ type: z.literal("unset"), path: z.string() })
]);

const body = z.object({ ops: z.array(incomingOpSchema).min(1).max(50) });

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
          !!app && (app.ownerId === auth.user.id || app.admins.some((a) => a.userId === auth.user.id)),
        appId: existing.appId,
        authType: auth.session.authType,
        ownerId: existing.ownerId,
        origin: "sdk"
      };
      // 把 zod 推断出来的 value?: unknown 收敛为 service 要求的 value: unknown。
      const ops = b.ops.map((op) => {
        if (op.type === "push") return { kind: "push" as const, path: op.path, value: op.value, uniq: op.uniq };
        if (op.type === "set") return { kind: "set" as const, path: op.path, value: op.value };
        if (op.type === "increment") return { kind: "increment" as const, path: op.path, by: op.value ?? 1 };
        return { kind: "unset" as const, path: op.path };
      });
      const r = await DataService.fieldOps(
        { appId: existing.appId, dataType: existing.dataType, recordId: existing.id, ops },
        { actor }
      );
      return r;
    }
  })
);

export const OPTIONS = withCors("app-domain", async () => new Response(null, { status: 204 }));
