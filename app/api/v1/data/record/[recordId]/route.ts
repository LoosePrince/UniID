/**
 * /api/v1/data/record/[recordId]
 *   GET   read
 *   PATCH update (merge)
 *   PUT   replace
 *   DELETE soft delete
 */
import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireSdkAuth, tryGetSdkAuth } from "@/shared/iam";
import { DataService } from "@/modules/data";
import { RecordRepository } from "@/modules/data";
import { ApiError } from "@/shared/errors";
import { prisma } from "@/shared/prisma";
import type { AuthContext } from "@/shared/policy";

const params = z.object({ recordId: idSchema });

async function buildActor(req: Request, appId: string, authType: "full" | "restricted" | null, userId: string | null, role: string | null) {
  const app = userId
    ? await prisma.app.findUnique({ where: { id: appId }, include: { admins: true } })
    : null;
  return {
    userId,
    role,
    systemAdmin: role === "admin",
    appAdmin: app ? app.ownerId === userId || app.admins.some((a) => a.userId === userId) : false,
    appId,
    authType: authType ?? "restricted",
    ownerId: null,
    origin: "sdk"
  } satisfies AuthContext;
}

export const GET = withCors(
  "app-domain",
  defineRoute({
    schema: { params },
    handler: async ({ params: p }, { req }) => {
      const existing = await RecordRepository.findById(p.recordId);
      if (!existing) throw new ApiError("DATA_RECORD_NOT_FOUND");
      const auth = await tryGetSdkAuth(req as never);
      if (auth && auth.app.id !== existing.appId) throw new ApiError("APP_ORIGIN_MISMATCH");
      const actor = await buildActor(
        req,
        existing.appId,
        auth?.session.authType ?? null,
        auth?.user.id ?? null,
        auth?.user.role ?? null
      );
      const record = await DataService.getById({
        appId: existing.appId,
        dataType: existing.dataType,
        recordId: existing.id,
        actor
      });
      return { record };
    }
  })
);

const patchBody = z.object({
  data: z.record(z.unknown())
});

async function runUpdate(req: Request, p: { recordId: string }, body: { data: Record<string, unknown> }, merge: boolean) {
  const existing = await RecordRepository.findById(p.recordId);
  if (!existing) throw new ApiError("DATA_RECORD_NOT_FOUND");
  const auth = await requireSdkAuth(req as never);
  if (auth.app.id !== existing.appId) throw new ApiError("APP_ORIGIN_MISMATCH");
  const actor = await buildActor(req, existing.appId, auth.session.authType, auth.user.id, auth.user.role);
  const record = await DataService.update(
    { appId: existing.appId, dataType: existing.dataType, recordId: existing.id, data: body.data, merge },
    { actor }
  );
  return { record };
}

export const PATCH = withCors(
  "app-domain",
  defineRoute({
    schema: { params, body: patchBody },
    handler: async ({ params: p, body }, { req }) => runUpdate(req, p, body, true)
  })
);

export const PUT = withCors(
  "app-domain",
  defineRoute({
    schema: { params, body: patchBody },
    handler: async ({ params: p, body }, { req }) => runUpdate(req, p, body, false)
  })
);

export const DELETE = withCors(
  "app-domain",
  defineRoute({
    schema: { params },
    handler: async ({ params: p }, { req }) => {
      const existing = await RecordRepository.findById(p.recordId);
      if (!existing) throw new ApiError("DATA_RECORD_NOT_FOUND");
      const auth = await requireSdkAuth(req as never);
      if (auth.app.id !== existing.appId) throw new ApiError("APP_ORIGIN_MISMATCH");
      const actor = await buildActor(req, existing.appId, auth.session.authType, auth.user.id, auth.user.role);
      const r = await DataService.delete(
        { appId: existing.appId, dataType: existing.dataType, recordId: existing.id },
        { actor }
      );
      return r;
    }
  })
);

export const OPTIONS = withCors("app-domain", async () => new Response(null, { status: 204 }));
