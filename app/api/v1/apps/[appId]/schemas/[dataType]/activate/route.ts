import { z } from "zod";
import { defineRoute, dataTypeSchema, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireConsoleAuth } from "@/shared/iam";
import { SchemaService } from "@/modules/schema";
import { AppService } from "@/modules/apps";
import { prisma } from "@/shared/prisma";
import { ApiError } from "@/shared/errors";

const params = z.object({ appId: idSchema, dataType: dataTypeSchema });
const body = z.object({ versionId: idSchema });

export const PUT = withCors(
  "admin-only",
  defineRoute({
    schema: { params, body },
    handler: async ({ params: p, body: b }) => {
      const auth = await requireConsoleAuth();
      const app = await prisma.app.findUnique({
        where: { id: p.appId },
        include: { admins: true }
      });
      if (!app) throw new ApiError("APP_NOT_FOUND");
      if (auth.user.role !== "admin") {
        await AppService.requireOwnerOrAdmin(app.ownerId, app.admins, auth.user.id);
      }
      const schema = await prisma.dataSchema.findUnique({
        where: { appId_dataType: { appId: p.appId, dataType: p.dataType } }
      });
      if (!schema) throw new ApiError("SCHEMA_NOT_FOUND");
      const version = await prisma.schemaVersion.findUnique({ where: { id: b.versionId } });
      if (!version || version.schemaId !== schema.id) throw new ApiError("SCHEMA_NOT_FOUND");
      await SchemaService.activate(schema.id, b.versionId, p.appId, p.dataType);
      return { success: true };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
