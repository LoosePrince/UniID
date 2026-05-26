/**
 * /api/v1/data/[appId]/[dataType]
 *   GET   query
 *   POST  create
 */
import { z } from "zod";
import { defineRoute, dataTypeSchema, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { tryGetSdkAuth, requireSdkAuth } from "@/shared/iam";
import { DataService } from "@/modules/data";
import type { AuthContext } from "@/shared/policy";
import { prisma } from "@/shared/prisma";
import { ApiError } from "@/shared/errors";

const params = z.object({ appId: idSchema, dataType: dataTypeSchema });

async function buildActorFromAuth(req: Request, appId: string): Promise<AuthContext> {
  const auth = await tryGetSdkAuth(req as never);
  if (!auth) {
    return {
      userId: null,
      role: null,
      systemAdmin: false,
      appAdmin: false,
      appId,
      authType: "restricted",
      ownerId: null,
      origin: "sdk"
    };
  }
  const app = await prisma.app.findUnique({
    where: { id: appId },
    include: { admins: true }
  });
  if (!app) throw new ApiError("APP_NOT_FOUND");
  return {
    userId: auth.user.id,
    role: auth.user.role,
    systemAdmin: auth.user.role === "admin",
    appAdmin: app.ownerId === auth.user.id || app.admins.some((a) => a.userId === auth.user.id),
    appId,
    authType: auth.session.authType,
    ownerId: null,
    origin: "sdk"
  };
}

const queryDsl = z.object({
  where: z.record(z.unknown()).optional(),
  select: z.array(z.string()).optional(),
  orderBy: z.record(z.string(), z.enum(["asc", "desc"])).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  cursor: z.string().optional()
});

export const GET = withCors(
  "app-domain",
  defineRoute({
    schema: { params, query: z.object({ q: z.string().optional() }) },
    handler: async ({ params: p, query }, { req }) => {
      let dsl = {};
      if (query?.q) {
        try {
          dsl = JSON.parse(query.q);
        } catch {
          throw new ApiError("DATA_QUERY_INVALID");
        }
      }
      const parsed = queryDsl.parse(dsl);
      const actor = await buildActorFromAuth(req, p.appId);
      const result = await DataService.query({
        appId: p.appId,
        dataType: p.dataType,
        dsl: parsed,
        actor
      });
      return result;
    }
  })
);

const createBody = z.object({
  data: z.record(z.string(), z.any()),
  ownerId: z.string().optional()
});

export const POST = withCors(
  "app-domain",
  defineRoute({
    schema: { params, body: createBody },
    handler: async ({ params: p, body }, { req }) => {
      const auth = await requireSdkAuth(req as never);
      const app = await prisma.app.findUnique({
        where: { id: p.appId },
        include: { admins: true }
      });
      if (!app) throw new ApiError("APP_NOT_FOUND");
      if (app.id !== auth.app.id) throw new ApiError("APP_ORIGIN_MISMATCH");
      const actor: AuthContext = {
        userId: auth.user.id,
        role: auth.user.role,
        systemAdmin: auth.user.role === "admin",
        appAdmin:
          app.ownerId === auth.user.id || app.admins.some((a) => a.userId === auth.user.id),
        appId: p.appId,
        authType: auth.session.authType,
        ownerId: null,
        origin: "sdk"
      };
      const ownerId = body.ownerId ?? auth.user.id;
      const record = await DataService.create(
        { appId: p.appId, dataType: p.dataType, ownerId, data: body.data },
        { actor }
      );
      return { record };
    }
  })
);

export const OPTIONS = withCors("app-domain", async () => new Response(null, { status: 204 }));
