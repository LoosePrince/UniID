/**
 * GET  /api/v1/apps/[appId]/schemas         列出全部 schema（每个最新版本）
 * POST /api/v1/apps/[appId]/schemas         新建/新增版本
 */
import { z } from "zod";
import { defineRoute, dataTypeSchema, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireConsoleAuth } from "@/shared/iam";
import { SchemaService } from "@/modules/schema";
import { AppService } from "@/modules/apps";
import { prisma } from "@/shared/prisma";

const params = z.object({ appId: idSchema });

const upsertBody = z.object({
  dataType: dataTypeSchema,
  jsonSchema: z.record(z.unknown()),
  autoFill: z.record(z.unknown()).optional(),
  validationRules: z.string().max(50_000).optional(),
  description: z.string().max(500).optional(),
  setActive: z.boolean().default(true)
});

export const GET = withCors(
  "admin-only",
  defineRoute({
    schema: { params },
    handler: async ({ params: p }) => {
      const auth = await requireConsoleAuth();
      const app = await prisma.app.findUnique({
        where: { id: p.appId },
        include: { admins: true }
      });
      if (!app) return { error: { code: "APP_NOT_FOUND" } };
      if (auth.user.role !== "admin") {
        await AppService.requireOwnerOrAdmin(app.ownerId, app.admins, auth.user.id);
      }
      const schemas = await SchemaService.listForApp(p.appId);
      return { schemas };
    }
  })
);

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { params, body: upsertBody },
    handler: async ({ params: p, body }) => {
      const auth = await requireConsoleAuth();
      const app = await prisma.app.findUnique({
        where: { id: p.appId },
        include: { admins: true }
      });
      if (!app) return { error: { code: "APP_NOT_FOUND" } };
      if (auth.user.role !== "admin") {
        await AppService.requireOwnerOrAdmin(app.ownerId, app.admins, auth.user.id);
      }
      const result = await SchemaService.upsertVersion({
        appId: p.appId,
        dataType: body.dataType,
        jsonSchema: body.jsonSchema,
        autoFill: body.autoFill,
        validationRules: body.validationRules,
        description: body.description,
        setActive: body.setActive,
        actorUserId: auth.user.id
      });
      return result;
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
