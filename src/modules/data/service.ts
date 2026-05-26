import { ApiError } from "@/shared/errors";
import { bus } from "@/shared/bus";
import { prisma } from "@/shared/prisma";
import { compileSchemaCached, formatAjvErrors } from "@/shared/validator";
import type { AuthContext } from "@/shared/policy";
import { SchemaService } from "@/modules/schema";

const now = () => Math.floor(Date.now() / 1000);

export interface RecordEnvelope<T = unknown> {
  id: string;
  appId: string;
  dataType: string;
  ownerId: string | null;
  data: T;
  createdAt: number;
  updatedAt: number;
}

export interface DataQuery {
  where?: Record<string, unknown>;
  select?: string[];
  orderBy?: Record<string, "asc" | "desc">;
  limit?: number;
  cursor?: string;
}

export type FieldOp =
  | { kind: "increment"; path: string; by: number }
  | { kind: "push"; path: string; value: unknown; uniq?: boolean }
  | { kind: "set"; path: string; value: unknown }
  | { kind: "unset"; path: string };

type StoredRecord = NonNullable<Awaited<ReturnType<typeof prisma.record.findFirst>>>;

export class RecordRepository {
  static async findById(recordId: string) {
    return prisma.record.findFirst({ where: { id: recordId, deletedAt: null } });
  }
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function actorId(actor: AuthContext): string {
  if (!actor.userId) throw new ApiError("AUTH_INVALID_TOKEN");
  return actor.userId;
}

function pickFields(data: unknown, fields?: string[]): unknown {
  if (!fields || fields.length === 0) return data;
  const source = asObject(data);
  return fields.reduce<Record<string, unknown>>((acc, field) => {
    if (Object.prototype.hasOwnProperty.call(source, field)) acc[field] = source[field];
    return acc;
  }, {});
}

function envelope(record: StoredRecord, select?: string[]): RecordEnvelope {
  const data = parseJson(record.data);
  return {
    id: record.id,
    appId: record.appId,
    dataType: record.dataType,
    ownerId: record.ownerId,
    data: pickFields(data, select),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function matchesWhere(data: unknown, where?: Record<string, unknown>): boolean {
  if (!where || Object.keys(where).length === 0) return true;
  const source = asObject(data);
  return Object.entries(where).every(([key, expected]) => source[key] === expected);
}

function compareValue(a: unknown, b: unknown, dir: "asc" | "desc") {
  const av = typeof a === "number" || typeof a === "string" ? a : JSON.stringify(a);
  const bv = typeof b === "number" || typeof b === "string" ? b : JSON.stringify(b);
  if (av === bv) return 0;
  const result = av > bv ? 1 : -1;
  return dir === "asc" ? result : -result;
}

function sortRecords(records: StoredRecord[], orderBy?: Record<string, "asc" | "desc">) {
  const entries = Object.entries(orderBy ?? {});
  if (entries.length === 0) return records;
  return [...records].sort((a, b) => {
    const ad = asObject(parseJson(a.data));
    const bd = asObject(parseJson(b.data));
    for (const [field, dir] of entries) {
      const result = compareValue(ad[field], bd[field], dir);
      if (result !== 0) return result;
    }
    return b.updatedAt - a.updatedAt;
  });
}

async function validateData(appId: string, dataType: string, data: unknown) {
  const schema = await SchemaService.tryLoadActive(appId, dataType);
  if (!schema) throw new ApiError("SCHEMA_REQUIRED");
  const validate = compileSchemaCached(schema.id, schema.jsonSchema);
  const target = asObject(data);
  if (!validate(target)) {
    throw new ApiError("SCHEMA_INVALID", { details: { errors: formatAjvErrors(validate.errors) } });
  }
  return { data: target, schemaVersionId: schema.id };
}

function assertRecordScope(record: StoredRecord, appId: string, dataType: string) {
  if (record.appId !== appId || record.dataType !== dataType) throw new ApiError("DATA_RECORD_NOT_FOUND");
}

function applyOp(data: Record<string, unknown>, op: FieldOp) {
  if (!/^[A-Za-z0-9_.-]+$/.test(op.path)) {
    throw new ApiError("DATA_QUERY_INVALID", { message: "字段路径不合法" });
  }
  const key = op.path;
  switch (op.kind) {
    case "set":
      data[key] = op.value;
      break;
    case "unset":
      delete data[key];
      break;
    case "increment": {
      const prev = data[key];
      const base = typeof prev === "number" ? prev : 0;
      data[key] = base + op.by;
      break;
    }
    case "push": {
      const prev = data[key];
      const next = Array.isArray(prev) ? [...prev] : [];
      if (!op.uniq || !next.some((item) => JSON.stringify(item) === JSON.stringify(op.value))) {
        next.push(op.value);
      }
      data[key] = next;
      break;
    }
  }
}

function normalizeQueryArgs(
  input:
    | { appId: string; dataType: string; dsl: DataQuery }
    | string,
  dataType?: string,
  q?: DataQuery
) {
  if (typeof input === "string") {
    if (!dataType) throw new ApiError("DATA_QUERY_INVALID");
    return { appId: input, dataType, dsl: q ?? {} };
  }
  return input;
}

export class DataService {
  static async query(
    input: { appId: string; dataType: string; dsl: DataQuery; actor?: AuthContext } | string,
    dataType?: string,
    q?: DataQuery
  ) {
    const { appId, dataType: type, dsl } = normalizeQueryArgs(input, dataType, q);
    const limit = Math.min(Math.max(dsl.limit ?? 50, 1), 200);
    const records = await prisma.record.findMany({
      where: { appId, dataType: type, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 500,
      ...(dsl.cursor ? { cursor: { id: dsl.cursor }, skip: 1 } : {})
    });
    const filtered = sortRecords(
      records.filter((record) => matchesWhere(parseJson(record.data), dsl.where)),
      dsl.orderBy
    );
    const page = filtered.slice(0, limit);
    const nextCursor = filtered.length > limit ? page[page.length - 1]?.id : undefined;
    return { records: page.map((record) => envelope(record, dsl.select)), nextCursor };
  }

  static async create(
    input: { appId: string; dataType: string; data: unknown; ownerId?: string | null },
    context: { actor: AuthContext }
  ) {
    const validated = await validateData(input.appId, input.dataType, input.data);
    const userId = actorId(context.actor);
    const t = now();
    const record = await prisma.record.create({
      data: {
        appId: input.appId,
        dataType: input.dataType,
        ownerId: input.ownerId ?? userId,
        data: JSON.stringify(validated.data),
        schemaVersionId: validated.schemaVersionId,
        createdAt: t,
        updatedAt: t,
        createdById: userId,
        updatedById: userId
      }
    });
    bus.emit("record.created", {
      appId: record.appId,
      dataType: record.dataType,
      recordId: record.id,
      ownerId: record.ownerId,
      data: parseJson(record.data),
      actorId: userId,
      at: t
    });
    return envelope(record);
  }

  static async getById(input: {
    appId: string;
    dataType: string;
    recordId: string;
    actor?: AuthContext;
  }) {
    const record = await RecordRepository.findById(input.recordId);
    if (!record) throw new ApiError("DATA_RECORD_NOT_FOUND");
    assertRecordScope(record, input.appId, input.dataType);
    return envelope(record);
  }

  static async get(recordId: string) {
    const record = await RecordRepository.findById(recordId);
    if (!record) throw new ApiError("DATA_RECORD_NOT_FOUND");
    return envelope(record);
  }

  static async update(
    input: {
      appId: string;
      dataType: string;
      recordId: string;
      data: unknown;
      merge: boolean;
    },
    context: { actor: AuthContext }
  ) {
    const existing = await RecordRepository.findById(input.recordId);
    if (!existing) throw new ApiError("DATA_RECORD_NOT_FOUND");
    assertRecordScope(existing, input.appId, input.dataType);
    const before = asObject(parseJson(existing.data));
    const next = input.merge ? { ...before, ...asObject(input.data) } : asObject(input.data);
    const validated = await validateData(existing.appId, existing.dataType, next);
    const userId = actorId(context.actor);
    const t = now();
    const record = await prisma.record.update({
      where: { id: existing.id },
      data: {
        data: JSON.stringify(validated.data),
        schemaVersionId: validated.schemaVersionId,
        updatedAt: t,
        updatedById: userId
      }
    });
    bus.emit("record.updated", {
      appId: record.appId,
      dataType: record.dataType,
      recordId: record.id,
      ownerId: record.ownerId,
      before,
      after: parseJson(record.data),
      actorId: userId,
      at: t
    });
    return envelope(record);
  }

  static async delete(
    input: { appId: string; dataType: string; recordId: string },
    context: { actor: AuthContext }
  ) {
    const existing = await RecordRepository.findById(input.recordId);
    if (!existing) throw new ApiError("DATA_RECORD_NOT_FOUND");
    assertRecordScope(existing, input.appId, input.dataType);
    const userId = actorId(context.actor);
    const t = now();
    await prisma.record.update({ where: { id: existing.id }, data: { deletedAt: t, updatedAt: t } });
    bus.emit("record.deleted", {
      appId: existing.appId,
      dataType: existing.dataType,
      recordId: existing.id,
      ownerId: existing.ownerId,
      actorId: userId,
      at: t
    });
    return { id: existing.id };
  }

  static async fieldOps(
    input: { appId: string; dataType: string; recordId: string; ops: FieldOp[] },
    context: { actor: AuthContext }
  ) {
    const existing = await RecordRepository.findById(input.recordId);
    if (!existing) throw new ApiError("DATA_RECORD_NOT_FOUND");
    assertRecordScope(existing, input.appId, input.dataType);
    const next = asObject(parseJson(existing.data));
    for (const op of input.ops) applyOp(next, op);
    return this.update(
      { appId: input.appId, dataType: input.dataType, recordId: input.recordId, data: next, merge: false },
      context
    );
  }
}