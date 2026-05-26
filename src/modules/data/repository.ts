/**
 * RecordRepository — Record 表的访问层（隔离 ORM 细节）。
 */
import { prisma } from "@/shared/prisma";

const now = () => Math.floor(Date.now() / 1000);

export interface RecordSnapshot {
  id: string;
  appId: string;
  dataType: string;
  ownerId: string | null;
  data: unknown;
  schemaVersionId: string | null;
  createdAt: number;
  updatedAt: number;
  createdById: string | null;
  updatedById: string | null;
}

function decode(row: {
  id: string;
  appId: string;
  dataType: string;
  ownerId: string | null;
  data: string;
  schemaVersionId: string | null;
  createdAt: number;
  updatedAt: number;
  createdById: string | null;
  updatedById: string | null;
}): RecordSnapshot {
  return {
    id: row.id,
    appId: row.appId,
    dataType: row.dataType,
    ownerId: row.ownerId,
    data: safeParseObject(row.data),
    schemaVersionId: row.schemaVersionId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdById: row.createdById,
    updatedById: row.updatedById
  };
}

function safeParseObject(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

export class RecordRepository {
  static async findById(id: string): Promise<RecordSnapshot | null> {
    const row = await prisma.record.findFirst({
      where: { id, deletedAt: null }
    });
    return row ? decode(row) : null;
  }

  static async create(input: {
    appId: string;
    dataType: string;
    ownerId: string | null;
    data: unknown;
    schemaVersionId: string | null;
    actorUserId: string | null;
  }): Promise<RecordSnapshot> {
    const t = now();
    const row = await prisma.record.create({
      data: {
        appId: input.appId,
        dataType: input.dataType,
        ownerId: input.ownerId,
        data: JSON.stringify(input.data),
        schemaVersionId: input.schemaVersionId,
        createdAt: t,
        updatedAt: t,
        createdById: input.actorUserId,
        updatedById: input.actorUserId
      }
    });
    return decode(row);
  }

  static async update(input: {
    id: string;
    data: unknown;
    schemaVersionId: string | null;
    actorUserId: string | null;
  }): Promise<RecordSnapshot> {
    const t = now();
    const row = await prisma.record.update({
      where: { id: input.id },
      data: {
        data: JSON.stringify(input.data),
        updatedAt: t,
        updatedById: input.actorUserId,
        schemaVersionId: input.schemaVersionId ?? undefined
      }
    });
    return decode(row);
  }

  static async softDelete(id: string): Promise<void> {
    const t = now();
    await prisma.record.update({ where: { id }, data: { deletedAt: t } });
  }
}
