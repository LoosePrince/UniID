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

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { params, body },
    handler: async ({ params: p, body: b }) => {
      const ctx = await requireAppAccess(p.appId);
      const record = await DataService.transition(
        {
          appId: p.appId,
          dataType: p.dataType,
          recordId: p.recordId,
          transition: b.transition ?? b.action!,
          data: b.data ?? {},
          metadata: b.metadata,
          merge: b.merge ?? true
        },
        { actor: consoleActor(ctx) }
      );
      return { record };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));