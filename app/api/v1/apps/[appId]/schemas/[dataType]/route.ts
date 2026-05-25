/**
 * GET    /api/v1/apps/[appId]/schemas/[dataType]            列出全部版本
 * PUT    /api/v1/apps/[appId]/schemas/[dataType]/activate   {versionId}
 */
import { z } from "zod";
import { defineRoute, dataTypeSchema, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireConsoleAuth } from "@/shared/iam";
import { SchemaService } from "@/modules/schema";
import { AppService } from "@/modules/apps";
import { prisma } from "@/shared/prisma";

const params = z.object({ appId: idSchema, dataType: dataTypeSchema });

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
      const schema = await SchemaService.listVersions(p.appId, p.dataType);
      return { schema };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
