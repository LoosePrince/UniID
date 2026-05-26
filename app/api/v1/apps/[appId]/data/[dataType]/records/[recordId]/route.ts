import { z } from "zod";
import { defineRoute, dataTypeSchema, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { DataService } from "@/modules/data";
import type { AuthContext } from "@/shared/policy";

const params = z.object({
  appId: idSchema,
  dataType: dataTypeSchema,
  recordId: idSchema
});

const dataBody = z.object({
  data: z.record(z.unknown())
});

function consoleActor(ctx: Awaited<ReturnType<typeof requireAppAccess>>): AuthContext {
  return {
    userId: ctx.user.id,
    role: ctx.user.role,
    systemAdmin: ctx.user.role === "admin",
    appAdmin: true,
    appId: ctx.app.id,
    authType: "full",
    ownerId: null,
    origin: "system"
  };
}

export const GET = withCors(
  "admin-only",
  defineRoute({
    schema: { params },
    handler: async ({ params: p }) => {
      const ctx = await requireAppAccess(p.appId);
      const record = await DataService.getById({
        appId: p.appId,
        dataType: p.dataType,
        recordId: p.recordId,
        actor: consoleActor(ctx)
      });
      return { record };
    }
  })
);

async function updateRecord(
  p: z.infer<typeof params>,
  body: z.infer<typeof dataBody>,
  merge: boolean
) {
  const ctx = await requireAppAccess(p.appId);
  const record = await DataService.update(
    { appId: p.appId, dataType: p.dataType, recordId: p.recordId, data: body.data, merge },
    { actor: consoleActor(ctx) }
  );
  return { record };
}

export const PATCH = withCors(
  "admin-only",
  defineRoute({
    schema: { params, body: dataBody },
    handler: async ({ params: p, body }) => updateRecord(p, body, true)
  })
);

export const PUT = withCors(
  "admin-only",
  defineRoute({
    schema: { params, body: dataBody },
    handler: async ({ params: p, body }) => updateRecord(p, body, false)
  })
);

export const DELETE = withCors(
  "admin-only",
  defineRoute({
    schema: { params },
    handler: async ({ params: p }) => {
      const ctx = await requireAppAccess(p.appId);
      return DataService.delete(
        { appId: p.appId, dataType: p.dataType, recordId: p.recordId },
        { actor: consoleActor(ctx) }
      );
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));