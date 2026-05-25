/**
 * SchemaService — DataSchema + SchemaVersion 的 CRUD 与读取。
 */
import { prisma } from "@/shared/prisma";
import { ApiError } from "@/shared/errors";
import { ajv, invalidateSchemaCache } from "@/shared/validator";
import { bus } from "@/shared/bus";

const now = () => Math.floor(Date.now() / 1000);

export interface SchemaSnapshot {
  id: string;
  schemaId: string;
  version: number;
  jsonSchema: object;
  autoFill: string | null;
  validationRules: string | null;
}

export class SchemaService {
  static async listForApp(appId: string) {
    return prisma.dataSchema.findMany({
      where: { appId },
      orderBy: { dataType: "asc" },
      include: {
        versions: {
          orderBy: { version: "desc" },
          select: {
            id: true,
            version: true,
            jsonSchema: true,
            autoFill: true,
            validationRules: true,
            isActive: true,
            createdAt: true
          }
        }
      }
    });
  }

  /** 加载活跃 schema 版本；不存在抛 SCHEMA_NOT_FOUND。 */
  static async loadActive(appId: string, dataType: string): Promise<SchemaSnapshot> {
    const schema = await prisma.dataSchema.findUnique({
      where: { appId_dataType: { appId, dataType } },
      include: {
        versions: { where: { isActive: 1 }, take: 1 }
      }
    });
    if (!schema) throw new ApiError("SCHEMA_NOT_FOUND");
    const version = schema.versions[0];
    if (!version) throw new ApiError("SCHEMA_NOT_FOUND");
    return {
      id: version.id,
      schemaId: schema.id,
      version: version.version,
      jsonSchema: JSON.parse(version.jsonSchema) as object,
      autoFill: version.autoFill,
      validationRules: version.validationRules
    };
  }

  static async tryLoadActive(appId: string, dataType: string): Promise<SchemaSnapshot | null> {
    try {
      return await this.loadActive(appId, dataType);
    } catch (e) {
      if (e instanceof ApiError && e.code === "SCHEMA_NOT_FOUND") return null;
      throw e;
    }
  }

  /** 创建/更新 schema 并新增一个 version。如果是 setActive，会切换 active。 */
  static async upsertVersion(input: {
    appId: string;
    dataType: string;
    jsonSchema: object;
    autoFill?: object;
    validationRules?: string;
    description?: string;
    setActive?: boolean;
    actorUserId?: string;
  }) {
    try {
      ajv().compile(input.jsonSchema);
    } catch (err) {
      throw new ApiError("SCHEMA_INVALID", {
        details: err instanceof Error ? err.message : String(err)
      });
    }

    const t = now();
    const schema = await prisma.dataSchema.upsert({
      where: { appId_dataType: { appId: input.appId, dataType: input.dataType } },
      create: {
        appId: input.appId,
        dataType: input.dataType,
        description: input.description,
        createdAt: t,
        updatedAt: t,
        createdById: input.actorUserId
      },
      update: { description: input.description, updatedAt: t }
    });

    const last = await prisma.schemaVersion.findFirst({
      where: { schemaId: schema.id },
      orderBy: { version: "desc" },
      select: { version: true }
    });
    const nextVersion = (last?.version ?? 0) + 1;

    const version = await prisma.schemaVersion.create({
      data: {
        schemaId: schema.id,
        version: nextVersion,
        jsonSchema: JSON.stringify(input.jsonSchema),
        autoFill: input.autoFill ? JSON.stringify(input.autoFill) : null,
        validationRules: input.validationRules ?? null,
        isActive: input.setActive ? 1 : 0,
        createdAt: t,
        createdById: input.actorUserId
      }
    });

    if (input.setActive) {
      await this.activate(schema.id, version.id, input.appId, input.dataType);
    }

    return { schema, version };
  }

  static async activate(schemaId: string, versionId: string, appId: string, dataType: string) {
    await prisma.$transaction([
      prisma.schemaVersion.updateMany({
        where: { schemaId, isActive: 1 },
        data: { isActive: 0 }
      }),
      prisma.schemaVersion.update({
        where: { id: versionId },
        data: { isActive: 1 }
      })
    ]);
    invalidateSchemaCache(versionId);
    const v = await prisma.schemaVersion.findUnique({ where: { id: versionId }, select: { version: true } });
    if (v) bus.emit("schema.activated", { appId, dataType, version: v.version, at: now() });
  }

  static async listVersions(appId: string, dataType: string) {
    const schema = await prisma.dataSchema.findUnique({
      where: { appId_dataType: { appId, dataType } },
      include: {
        versions: { orderBy: { version: "desc" } }
      }
    });
    if (!schema) throw new ApiError("SCHEMA_NOT_FOUND");
    return schema;
  }
}
