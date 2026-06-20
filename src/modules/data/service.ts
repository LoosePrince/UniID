import { ApiError } from "@/shared/errors";
import { prisma } from "@/shared/prisma";
import { PolicyEngine, type AuthContext, type PolicyAction } from "@/shared/policy";
import { AppDatabaseService } from "@/modules/app-databases";
import { DataPipeline } from "./pipeline";

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

function snapshotEnvelope(record: {
  id: string;
  appId: string;
  dataType: string;
  ownerId: string | null;
  data: unknown;
  createdAt: number;
  updatedAt: number;
}, select?: string[]): RecordEnvelope {
  return {
    id: record.id,
    appId: record.appId,
    dataType: record.dataType,
    ownerId: record.ownerId,
    data: pickFields(record.data, select),
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

function assertRecordScope(record: StoredRecord, appId: string, dataType: string) {
  if (record.appId !== appId || record.dataType !== dataType) throw new ApiError("DATA_RECORD_NOT_FOUND");
}

function normalizeQueryArgs(
  input:
    | { appId: string; dataType: string; dsl: DataQuery; actor?: AuthContext }
    | string,
  dataType?: string,
  q?: DataQuery
) {
  if (typeof input === "string") {
    if (!dataType) throw new ApiError("DATA_QUERY_INVALID");
    return { appId: input, dataType, dsl: q ?? {}, actor: undefined };
  }
  return input;
}

function anonymousActor(appId: string): AuthContext {
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

async function loadPolicyDocuments(appId: string, dataType: string, recordId?: string) {
  const where = [
    { scope: "app" as const, target: null as string | null },
    { scope: "dataType" as const, target: dataType },
    ...(recordId ? [{ scope: "record" as const, target: recordId }] : [])
  ];
  const docs = await prisma.policyDocument.findMany({
    where: { appId, OR: where as Array<{ scope: string; target: string | null }> }
  });
  const orderKey = { app: 0, dataType: 1, record: 2 };
  return docs
    .sort(
      (a, b) =>
        (orderKey as Record<string, number>)[a.scope]! -
        (orderKey as Record<string, number>)[b.scope]!
    )
    .map((d) => d.document);
}

function readableEnvelope(
  record: StoredRecord,
  docs: string[],
  actor: AuthContext,
  select?: string[]
): RecordEnvelope | null {
  const data = asObject(parseJson(record.data));
  const scopedActor = { ...actor, ownerId: record.ownerId };
  const whole = PolicyEngine.evaluate(
    { documents: docs, action: "read", currentValue: data },
    scopedActor
  );

  if (whole.allow) return envelope(record, select);

  const filteredData = PolicyEngine.filterReadable(data, docs, scopedActor);
  if (Object.keys(filteredData).length === 0) return null;

  return {
    id: record.id,
    appId: record.appId,
    dataType: record.dataType,
    ownerId: record.ownerId,
    data: pickFields(filteredData, select),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function normalizeDataPath(path: string): string[] {
  if (!/^[A-Za-z0-9_.-]+$/.test(path)) {
    throw new ApiError("DATA_QUERY_INVALID", { message: "error.detail.fieldPathInvalid" });
  }
  const value = path.startsWith("data.") ? path.slice("data.".length) : path;
  const parts = value.split(".").filter(Boolean);
  if (parts.length === 0) throw new ApiError("DATA_QUERY_INVALID", { message: "error.detail.fieldPathInvalid" });
  return parts;
}

function ensureObjectContainer(target: Record<string, unknown>, key: string): Record<string, unknown> {
  const current = target[key];
  if (current && typeof current === "object" && !Array.isArray(current)) {
    return current as Record<string, unknown>;
  }
  const next: Record<string, unknown> = {};
  target[key] = next;
  return next;
}

function writeAtPath(data: Record<string, unknown>, parts: string[], value: unknown) {
  let cursor = data;
  for (const part of parts.slice(0, -1)) cursor = ensureObjectContainer(cursor, part);
  const leaf = parts[parts.length - 1];
  if (!leaf) throw new ApiError("DATA_QUERY_INVALID");
  cursor[leaf] = value;
}

function readAtPath(data: Record<string, unknown>, parts: string[]): unknown {
  let cursor: unknown = data;
  for (const part of parts) {
    if (cursor == null || typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
}

function deleteAtPath(data: Record<string, unknown>, parts: string[]) {
  let cursor: unknown = data;
  for (const part of parts.slice(0, -1)) {
    if (cursor == null || typeof cursor !== "object") return;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  const leaf = parts[parts.length - 1];
  if (leaf && cursor && typeof cursor === "object") delete (cursor as Record<string, unknown>)[leaf];
}

function applyOp(data: Record<string, unknown>, op: FieldOp): { policyFieldPath: string; mutationPath: string } {
  const parts = normalizeDataPath(op.path);
  const policyFieldPath = `data.${parts[0]}`;
  const mutationPath = `data.${parts.join(".")}`;

  switch (op.kind) {
    case "set":
      writeAtPath(data, parts, op.value);
      break;
    case "unset":
      deleteAtPath(data, parts);
      break;
    case "increment": {
      const prev = readAtPath(data, parts);
      const base = typeof prev === "number" ? prev : 0;
      writeAtPath(data, parts, base + op.by);
      break;
    }
    case "push": {
      const prev = readAtPath(data, parts);
      const next = Array.isArray(prev) ? [...prev] : [];
      if (!op.uniq || !next.some((item) => JSON.stringify(item) === JSON.stringify(op.value))) {
        next.push(op.value);
      }
      writeAtPath(data, parts, next);
      break;
    }
  }

  return { policyFieldPath, mutationPath };
}

export class DataService {
  static async query(
    input: { appId: string; dataType: string; dsl: DataQuery; actor?: AuthContext } | string,
    dataType?: string,
    q?: DataQuery
  ) {
    const { appId, dataType: type, dsl, actor: providedActor } = normalizeQueryArgs(input, dataType, q);
    await AppDatabaseService.assertMainStorageReadable(appId, type);
    const actor = providedActor ?? anonymousActor(appId);
    const docs = await loadPolicyDocuments(appId, type);
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
    const readable = filtered
      .map((record) => readableEnvelope(record, docs, actor, dsl.select))
      .filter((record): record is RecordEnvelope => record !== null);
    const page = readable.slice(0, limit);
    const nextCursor = readable.length > limit ? page[page.length - 1]?.id : undefined;
    return { records: page, nextCursor };
  }

  static async create(
    input: { appId: string; dataType: string; data: unknown; ownerId?: string | null },
    context: { actor: AuthContext }
  ) {
    const result = await DataPipeline.execute(
      {
        op: "create",
        appId: input.appId,
        dataType: input.dataType,
        ownerId: input.ownerId ?? context.actor.userId,
        data: asObject(input.data)
      },
      { actor: context.actor }
    );
    return snapshotEnvelope(result.record);
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
    await AppDatabaseService.assertMainStorageReadable(input.appId, input.dataType);
    const actor = input.actor ?? anonymousActor(input.appId);
    const docs = await loadPolicyDocuments(input.appId, input.dataType, input.recordId);
    const readable = readableEnvelope(record, docs, actor);
    if (!readable) throw new ApiError("POLICY_FORBIDDEN");
    return readable;
  }

  static async get(recordId: string) {
    const record = await RecordRepository.findById(recordId);
    if (!record) throw new ApiError("DATA_RECORD_NOT_FOUND");
    await AppDatabaseService.assertMainStorageReadable(record.appId, record.dataType);
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
    const result = await DataPipeline.execute(
      {
        op: "update",
        appId: input.appId,
        dataType: input.dataType,
        recordId: input.recordId,
        data: asObject(input.data),
        merge: input.merge
      },
      { actor: context.actor }
    );
    return snapshotEnvelope(result.record);
  }

  static async transition(
    input: {
      appId: string;
      dataType: string;
      recordId: string;
      transition: string;
      data: unknown;
      merge?: boolean;
      metadata?: Record<string, unknown>;
    },
    context: { actor: AuthContext }
  ) {
    const result = await DataPipeline.execute(
      {
        op: "update",
        appId: input.appId,
        dataType: input.dataType,
        recordId: input.recordId,
        data: asObject(input.data),
        merge: input.merge ?? false,
        transition: input.transition,
        metadata: input.metadata
      },
      { actor: context.actor }
    );
    return snapshotEnvelope(result.record);
  }

  static async delete(
    input: { appId: string; dataType: string; recordId: string },
    context: { actor: AuthContext }
  ) {
    return DataPipeline.deleteRecord(input, { actor: context.actor });
  }

  static async fieldOps(
    input: { appId: string; dataType: string; recordId: string; ops: FieldOp[] },
    context: { actor: AuthContext }
  ) {
    const existing = await RecordRepository.findById(input.recordId);
    if (!existing) throw new ApiError("DATA_RECORD_NOT_FOUND");
    assertRecordScope(existing, input.appId, input.dataType);
    await AppDatabaseService.assertMainStorageReadable(input.appId, input.dataType);
    const next = asObject(parseJson(existing.data));
    const policyActions: Record<string, PolicyAction> = {};
    const mutationActions: Record<string, string> = {};

    for (const op of input.ops) {
      const { policyFieldPath, mutationPath } = applyOp(next, op);
      policyActions[policyFieldPath] = op.kind;
      mutationActions[mutationPath] = op.kind;
    }

    const result = await DataPipeline.execute(
      {
        op: "update",
        appId: input.appId,
        dataType: input.dataType,
        recordId: input.recordId,
        data: next,
        merge: false,
        policyActions,
        mutationActions
      },
      { actor: context.actor }
    );

    return snapshotEnvelope(result.record);
  }
}
