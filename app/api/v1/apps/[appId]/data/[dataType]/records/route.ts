import { z } from "zod";
import { defineRoute, dataTypeSchema, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { DataService } from "@/modules/data";
import type { AuthContext } from "@/shared/policy";
import { ApiError } from "@/shared/errors";

const params = z.object({ appId: idSchema, dataType: dataTypeSchema });

const queryDsl = z.object({
  where: z.record(z.unknown()).optional(),
  select: z.array(z.string()).optional(),
  orderBy: z.record(z.string(), z.enum(["asc", "desc"])).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  cursor: z.string().optional()
});

const createBody = z.object({
  data: z.record(z.unknown()),
  ownerId: z.string().optional()
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
    schema: { params, query: z.object({ q: z.string().optional() }) },
    handler: async ({ params: p, query }) => {
      const ctx = await requireAppAccess(p.appId);
      let dsl: unknown = {};
      if (query?.q) {
        try {
          dsl = JSON.parse(query.q) as unknown;
        } catch {
          throw new ApiError("DATA_QUERY_INVALID");
        }
      }

      return DataService.query({
        appId: p.appId,
        dataType: p.dataType,
        dsl: queryDsl.parse(dsl),
        actor: consoleActor(ctx)
      });
    }
  })
);

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { params, body: createBody },
    handler: async ({ params: p, body }) => {
      const ctx = await requireAppAccess(p.appId);
      const record = await DataService.create(
        {
          appId: p.appId,
          dataType: p.dataType,
          ownerId: body.ownerId,
          data: body.data
        },
        { actor: consoleActor(ctx) }
      );
      return { record };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));