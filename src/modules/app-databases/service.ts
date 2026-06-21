import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import type { Database as DatabaseHandle, Statement } from "better-sqlite3";
import type { AppDatabase, AppDatabaseKey } from "@prisma/client";
import { ApiError } from "@/shared/errors";
import { prisma } from "@/shared/prisma";
import { getSystemConfig } from "@/shared/system-config";
import { AuditService } from "@/shared/audit";
import { QuotaService } from "@/shared/quota";
import { enforceRateLimit } from "@/shared/ratelimit";
import { logger } from "@/shared/logger";
import { generateDatabaseKey, hashDatabaseKey, isDatabaseKey } from "./key";
import {
  assertSqlSafe,
  normalizeStatement,
  quoteIdentifier,
  validateIdentifier,
  type SqlMode,
  type SqlParams,
  type SqlStatementInput
} from "./sql";

const now = () => Math.floor(Date.now() / 1000);
const MAIN_TABLE_BASE_COLUMNS = [
  `"id" text primary key`,
  `"owner_id" text`,
  `"created_at" integer not null`,
  `"updated_at" integer not null`,
  `"deleted_at" integer`,
  `"data_json" text not null`
];

type DatabaseRow = AppDatabase & {
  keys?: AppDatabaseKey[];
  app?: { id: string; status: string };
};

export interface DatabaseAuthContext {
  appId: string;
  database: AppDatabase;
  key: AppDatabaseKey;
}

export interface ExecuteQueryInput {
  appId?: string;
  databaseId: string;
  sql: string;
  params?: SqlParams;
  mode?: SqlMode;
  external?: boolean;
  actorUserId?: string | null;
}

export interface ExecuteTransactionInput {
  appId?: string;
  databaseId: string;
  statements: SqlStatementInput[];
  external?: boolean;
  actorUserId?: string | null;
}

function clientIpLike(ip?: string | null) {
  return ip && ip.trim().length > 0 ? ip.trim() : "unknown";
}

function jsonByteLength(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function responseBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function safeParseJson(value: string | null | undefined): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function plainObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isSimpleJsonSchemaType(type: unknown): type is "string" | "number" | "integer" | "boolean" {
  return type === "string" || type === "number" || type === "integer" || type === "boolean";
}

function sqliteTypeForJsonSchema(type: "string" | "number" | "integer" | "boolean") {
  switch (type) {
    case "number":
      return "real";
    case "integer":
    case "boolean":
      return "integer";
    case "string":
    default:
      return "text";
  }
}

function valueForSqlite(value: unknown, type?: string): unknown {
  if (value === undefined) return null;
  if (type === "boolean") return value ? 1 : 0;
  if (type === "integer") return typeof value === "number" ? Math.trunc(value) : value;
  if (value && typeof value === "object") return JSON.stringify(value);
  return value ?? null;
}

function coerceRows(rows: unknown[]): unknown[] {
  return rows.map((row) => {
    if (!row || typeof row !== "object") return row;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
      out[key] = typeof value === "bigint" ? Number(value) : value;
    }
    return out;
  });
}

function isReadStatement(stmt: Statement): boolean {
  return Boolean(stmt.reader);
}

function ensureReadMode(stmt: Statement, mode: SqlMode) {
  if (mode === "read" && !isReadStatement(stmt)) {
    throw new ApiError("DATABASE_SQL_FORBIDDEN", {
      details: { reason: "mode=read only allows read statements" }
    });
  }
}

function runPrepared(stmt: Statement, params: SqlParams) {
  if (isReadStatement(stmt)) {
    const rows = Array.isArray(params) ? stmt.all(...params) : stmt.all(params);
    return { rows: coerceRows(rows), changes: 0, lastInsertRowid: null };
  }
  const info = Array.isArray(params) ? stmt.run(...params) : stmt.run(params);
  return {
    rows: [],
    changes: info.changes,
    lastInsertRowid:
      typeof info.lastInsertRowid === "bigint" ? Number(info.lastInsertRowid) : info.lastInsertRowid
  };
}

function sqlFileSize(filePath: string): bigint {
  let total = BigInt(0);
  for (const candidate of [filePath, `${filePath}-wal`, `${filePath}-shm`]) {
    try {
      total += BigInt(fs.statSync(candidate).size);
    } catch {
      // file may not exist yet
    }
  }
  return total;
}

function makeFilename(appId: string, name: string) {
  const safeName = name.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "database";
  return `${appId}-${safeName}-${randomUUID()}.sqlite`;
}

async function databasesRoot(): Promise<string> {
  const systemConfig = await getSystemConfig();
  return path.resolve(process.cwd(), systemConfig.uniidDatabasesDir);
}

export async function resolveDatabasePath(filename: string): Promise<string> {
  if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    throw new ApiError("DATABASE_PATH_INVALID");
  }
  const root = await databasesRoot();
  const full = path.resolve(root, filename);
  const rel = path.relative(root, full);
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new ApiError("DATABASE_PATH_INVALID");
  return full;
}

function ensureParentDirectory(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function openSqlite(filePath: string, readonly = false): DatabaseHandle {
  ensureParentDirectory(filePath);
  const db = new Database(filePath, { readonly, fileMustExist: readonly });
  if (!readonly) db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

function sanitizeDatabase(row: DatabaseRow) {
  return {
    id: row.id,
    appId: row.appId,
    name: row.name,
    filename: row.filename,
    status: row.status,
    note: row.note,
    createdById: row.createdById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastAccessAt: row.lastAccessAt,
    deletedAt: row.deletedAt,
    keys: row.keys?.map((key) => ({
      id: key.id,
      label: key.label,
      prefix: key.prefix,
      createdById: key.createdById,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
      revokedAt: key.revokedAt
    }))
  };
}

function sanitizeDatabaseKey(key: AppDatabaseKey) {
  return {
    id: key.id,
    label: key.label,
    prefix: key.prefix,
    createdById: key.createdById,
    createdAt: key.createdAt,
    lastUsedAt: key.lastUsedAt,
    revokedAt: key.revokedAt
  };
}

async function enforceDatabaseUsage(appId: string, ip?: string | null) {
  const quota = await QuotaService.getOrDefault(appId);
  await enforceRateLimit({
    key: `database:${appId}:ip:${clientIpLike(ip)}`,
    capacity: quota.rpsLimit,
    refillPerSecond: quota.rpsLimit
  });
  await QuotaService.consume(appId, "apiCalls", 1);
}

async function applyStorageDelta(appId: string, before: bigint, after: bigint) {
  const delta = after - before;
  if (delta > BigInt(0)) await QuotaService.consume(appId, "storageBytes", delta);
  if (delta < BigInt(0)) await QuotaService.releaseStorage(appId, -delta);
}

async function getActiveBinding(appId: string, dataType: string) {
  return prisma.dataStorageBinding.findUnique({
    where: { appId_dataType: { appId, dataType } }
  });
}

async function assertDatabaseAccessible(databaseId: string, appId?: string) {
  const db = await prisma.appDatabase.findFirst({
    where: { id: databaseId, ...(appId ? { appId } : {}) },
    include: { app: true, keys: { orderBy: { createdAt: "desc" } } }
  });
  if (!db) throw new ApiError("DATABASE_NOT_FOUND");
  if (db.status !== "active" || db.deletedAt) throw new ApiError("DATABASE_DISABLED");
  if (db.app.status !== "active") throw new ApiError("APP_FORBIDDEN");
  return db;
}

function columnsFromSchema(jsonSchema: unknown) {
  const root = plainObject(jsonSchema);
  const properties = plainObject(root.properties);
  const columns: Array<{ name: string; type: "string" | "number" | "integer" | "boolean" }> = [];
  for (const [name, prop] of Object.entries(properties)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) continue;
    const type = plainObject(prop).type;
    if (isSimpleJsonSchemaType(type)) columns.push({ name, type });
  }
  return columns;
}

export class AppDatabaseService {
  static async list(appId: string) {
    const rows = await prisma.appDatabase.findMany({
      where: { appId },
      include: { keys: { orderBy: { createdAt: "desc" } } },
      orderBy: { createdAt: "desc" }
    });
    return rows.map(sanitizeDatabase);
  }

  static async create(input: {
    appId: string;
    name: string;
    note?: string;
    createdById?: string | null;
    createKey?: boolean;
    keyLabel?: string;
  }) {
    const app = await prisma.app.findUnique({ where: { id: input.appId } });
    if (!app) throw new ApiError("APP_NOT_FOUND");
    const t = now();
    const filename = makeFilename(input.appId, input.name);
    const filePath = await resolveDatabasePath(filename);
    const generated = input.createKey === false ? null : generateDatabaseKey();
    const beforeSize = sqlFileSize(filePath);
    const dbh = openSqlite(filePath);
    dbh.close();
    const afterSize = sqlFileSize(filePath);
    await applyStorageDelta(input.appId, beforeSize, afterSize);

    let created: DatabaseRow;
    try {
      created = await prisma.appDatabase.create({
        data: {
          appId: input.appId,
          name: input.name,
          note: input.note,
          filename,
          path: filePath,
          createdById: input.createdById ?? null,
          createdAt: t,
          updatedAt: t,
          ...(generated
            ? {
                keys: {
                  create: {
                    label: input.keyLabel ?? "default",
                    keyHash: generated.hash,
                    prefix: generated.prefix,
                    createdById: input.createdById ?? null,
                    createdAt: t
                  }
                }
              }
            : {})
        },
        include: { keys: { orderBy: { createdAt: "desc" } } }
      });
    } catch (err) {
      for (const candidate of [filePath, `${filePath}-wal`, `${filePath}-shm`]) {
        try {
          fs.rmSync(candidate, { force: true });
        } catch (cleanupErr) {
          logger.warn({ err: cleanupErr, candidate }, "failed to cleanup database file after create failure");
        }
      }
      await applyStorageDelta(input.appId, afterSize, beforeSize);
      throw err;
    }

    AuditService.log({
      appId: input.appId,
      userId: input.createdById ?? null,
      action: "app.database.create",
      resourceType: "app_database",
      resourceId: created.id,
      after: { name: created.name, filename: created.filename }
    });

    return { database: sanitizeDatabase(created), secret: generated?.plain };
  }

  static async get(appId: string, databaseId: string) {
    const db = await prisma.appDatabase.findFirst({
      where: { id: databaseId, appId },
      include: { keys: { orderBy: { createdAt: "desc" } } }
    });
    if (!db) throw new ApiError("DATABASE_NOT_FOUND");
    return sanitizeDatabase(db);
  }

  static async update(input: {
    appId: string;
    databaseId: string;
    actorUserId?: string | null;
    name?: string;
    note?: string | null;
    status?: "active" | "disabled";
  }) {
    const existing = await prisma.appDatabase.findFirst({
      where: { id: input.databaseId, appId: input.appId }
    });
    if (!existing) throw new ApiError("DATABASE_NOT_FOUND");
    if (existing.status === "deleted" || existing.deletedAt) throw new ApiError("DATABASE_DISABLED");
    const updated = await prisma.appDatabase.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        note: input.note,
        status: input.status,
        updatedAt: now()
      },
      include: { keys: { orderBy: { createdAt: "desc" } } }
    });
    AuditService.log({
      appId: input.appId,
      userId: input.actorUserId ?? null,
      action: "app.database.update",
      resourceType: "app_database",
      resourceId: existing.id,
      before: { name: existing.name, note: existing.note, status: existing.status },
      after: { name: updated.name, note: updated.note, status: updated.status }
    });
    return sanitizeDatabase(updated);
  }

  static async softDelete(appId: string, databaseId: string, actorUserId?: string | null) {
    const existing = await prisma.appDatabase.findFirst({ where: { id: databaseId, appId } });
    if (!existing) throw new ApiError("DATABASE_NOT_FOUND");
    const t = now();
    const updated = await prisma.appDatabase.update({
      where: { id: existing.id },
      data: { status: "deleted", deletedAt: existing.deletedAt ?? t, updatedAt: t },
      include: { keys: { orderBy: { createdAt: "desc" } } }
    });
    AuditService.log({
      appId,
      userId: actorUserId ?? null,
      action: "app.database.delete",
      resourceType: "app_database",
      resourceId: existing.id,
      before: { status: existing.status },
      after: { status: updated.status, deletedAt: updated.deletedAt }
    });
    return sanitizeDatabase(updated);
  }

  static async restore(appId: string, databaseId: string, actorUserId?: string | null) {
    const existing = await prisma.appDatabase.findFirst({ where: { id: databaseId, appId } });
    if (!existing) throw new ApiError("DATABASE_NOT_FOUND");
    const updated = await prisma.appDatabase.update({
      where: { id: existing.id },
      data: { status: "active", deletedAt: null, updatedAt: now() },
      include: { keys: { orderBy: { createdAt: "desc" } } }
    });
    AuditService.log({
      appId,
      userId: actorUserId ?? null,
      action: "app.database.restore",
      resourceType: "app_database",
      resourceId: existing.id,
      after: { status: updated.status }
    });
    return sanitizeDatabase(updated);
  }

  static async permanentDelete(appId: string, databaseId: string, actorUserId?: string | null) {
    const existing = await prisma.appDatabase.findFirst({ where: { id: databaseId, appId } });
    if (!existing) throw new ApiError("DATABASE_NOT_FOUND");
    const filePath = await resolveDatabasePath(existing.filename);
    const size = sqlFileSize(filePath);
    await prisma.appDatabase.delete({ where: { id: existing.id } });
    for (const candidate of [filePath, `${filePath}-wal`, `${filePath}-shm`]) {
      try {
        fs.rmSync(candidate, { force: true });
      } catch (err) {
        logger.warn({ err, candidate }, "failed to remove database file");
      }
    }
    if (size > BigInt(0)) await QuotaService.releaseStorage(appId, size);
    AuditService.log({
      appId,
      userId: actorUserId ?? null,
      action: "app.database.permanent_delete",
      resourceType: "app_database",
      resourceId: existing.id,
      before: { name: existing.name, filename: existing.filename, size: Number(size) }
    });
    return { ok: true };
  }

  static async rotateKey(input: {
    appId: string;
    databaseId: string;
    keyId?: string;
    label?: string;
    actorUserId?: string | null;
  }) {
    const db = await prisma.appDatabase.findFirst({
      where: { id: input.databaseId, appId: input.appId },
      include: { keys: { orderBy: { createdAt: "desc" } } }
    });
    if (!db) throw new ApiError("DATABASE_NOT_FOUND");
    if (db.status === "deleted" || db.deletedAt) throw new ApiError("DATABASE_DISABLED");
    const generated = generateDatabaseKey();
    const t = now();
    const target = input.keyId
      ? db.keys.find((key) => key.id === input.keyId)
      : db.keys.find((key) => !key.revokedAt);
    const key = target
      ? await prisma.appDatabaseKey.update({
          where: { id: target.id },
          data: {
            label: input.label ?? target.label,
            keyHash: generated.hash,
            prefix: generated.prefix,
            lastUsedAt: null,
            revokedAt: null
          }
        })
      : await prisma.appDatabaseKey.create({
          data: {
            databaseId: db.id,
            label: input.label ?? "default",
            keyHash: generated.hash,
            prefix: generated.prefix,
            createdById: input.actorUserId ?? null,
            createdAt: t
          }
        });
    AuditService.log({
      appId: input.appId,
      userId: input.actorUserId ?? null,
      action: "app.database_key.rotate",
      resourceType: "app_database_key",
      resourceId: key.id,
      after: { databaseId: db.id, prefix: key.prefix }
    });
    return {
      key: sanitizeDatabaseKey(key),
      secret: generated.plain
    };
  }

  static async revokeKey(input: {
    appId: string;
    databaseId: string;
    keyId: string;
    actorUserId?: string | null;
  }) {
    const db = await prisma.appDatabase.findFirst({
      where: { id: input.databaseId, appId: input.appId },
      include: { keys: true }
    });
    if (!db) throw new ApiError("DATABASE_NOT_FOUND");
    const existing = db.keys.find((key) => key.id === input.keyId);
    if (!existing) throw new ApiError("AUTH_INVALID_TOKEN");
    const updated = await prisma.appDatabaseKey.update({
      where: { id: existing.id },
      data: { revokedAt: existing.revokedAt ?? now() }
    });
    AuditService.log({
      appId: input.appId,
      userId: input.actorUserId ?? null,
      action: "app.database_key.revoke",
      resourceType: "app_database_key",
      resourceId: updated.id,
      after: { revokedAt: updated.revokedAt }
    });
    return sanitizeDatabaseKey(updated);
  }

  static async authenticateBearer(token: string, opts?: { ip?: string | null }): Promise<DatabaseAuthContext> {
    if (!isDatabaseKey(token)) throw new ApiError("AUTH_INVALID_TOKEN");
    const key = await prisma.appDatabaseKey.findUnique({
      where: { keyHash: hashDatabaseKey(token) },
      include: { database: { include: { app: true } } }
    });
    if (!key) throw new ApiError("AUTH_INVALID_TOKEN");
    if (key.revokedAt) throw new ApiError("DATABASE_KEY_REVOKED");
    if (key.database.status !== "active" || key.database.deletedAt) throw new ApiError("DATABASE_DISABLED");
    if (key.database.app.status !== "active") throw new ApiError("APP_FORBIDDEN");
    await enforceDatabaseUsage(key.database.appId, opts?.ip);
    const t = now();
    void prisma.appDatabaseKey.update({ where: { id: key.id }, data: { lastUsedAt: t } }).catch(() => {});
    void prisma.appDatabase.update({ where: { id: key.databaseId }, data: { lastAccessAt: t } }).catch(() => {});
    return { appId: key.database.appId, database: key.database, key };
  }

  static async executeQuery(input: ExecuteQueryInput) {
    const db = await assertDatabaseAccessible(input.databaseId, input.appId);
    return this.executeOnDatabase(db, [{ sql: input.sql, params: input.params, mode: input.mode }], {
      transaction: false,
      external: input.external ?? false,
      actorUserId: input.actorUserId ?? null
    });
  }

  static async executeTransaction(input: ExecuteTransactionInput) {
    const db = await assertDatabaseAccessible(input.databaseId, input.appId);
    return this.executeOnDatabase(db, input.statements, {
      transaction: true,
      external: input.external ?? false,
      actorUserId: input.actorUserId ?? null
    });
  }

  static async executeAuthenticatedQuery(
    auth: DatabaseAuthContext,
    input: Omit<ExecuteQueryInput, "databaseId" | "appId" | "external">
  ) {
    return this.executeOnDatabase(auth.database, [{ sql: input.sql, params: input.params, mode: input.mode }], {
      transaction: false,
      external: true,
      actorUserId: input.actorUserId ?? null
    });
  }

  static async executeAuthenticatedTransaction(
    auth: DatabaseAuthContext,
    input: Omit<ExecuteTransactionInput, "databaseId" | "appId" | "external">
  ) {
    return this.executeOnDatabase(auth.database, input.statements, {
      transaction: true,
      external: true,
      actorUserId: input.actorUserId ?? null
    });
  }

  private static async executeOnDatabase(
    db: AppDatabase,
    statements: SqlStatementInput[],
    opts: { transaction: boolean; external: boolean; actorUserId: string | null }
  ) {
    if (statements.length === 0 || statements.length > 100) {
      throw new ApiError("DATABASE_SQL_INVALID", { details: { reason: "statement count must be 1-100" } });
    }
    const normalized = statements.map(normalizeStatement);
    if (opts.external) normalized.forEach((stmt) => assertSqlSafe(stmt.sql));

    const filePath = await resolveDatabasePath(db.filename);
    const before = sqlFileSize(filePath);
    const handle = openSqlite(filePath);
    let results: unknown[];
    try {
      const runOne = (stmtInput: Required<SqlStatementInput>) => {
        const prepared = handle.prepare(stmtInput.sql);
        ensureReadMode(prepared, stmtInput.mode);
        return runPrepared(prepared, stmtInput.params);
      };
      if (opts.transaction) {
        const tx = handle.transaction(() => normalized.map(runOne));
        results = tx();
      } else {
        results = [runOne(normalized[0]!)];
      }
    } finally {
      handle.close();
    }

    const after = sqlFileSize(filePath);
    await applyStorageDelta(db.appId, before, after);
    const bytes = responseBytes(results);
    if (bytes > 0) await QuotaService.consume(db.appId, "egressBytes", bytes);
    AuditService.log({
      appId: db.appId,
      userId: opts.actorUserId,
      action: opts.transaction ? "app.database.transaction" : "app.database.query",
      resourceType: "app_database",
      resourceId: db.id,
      after: {
        external: opts.external,
        statementCount: normalized.length,
        egressBytes: bytes,
        storageDelta: Number(after - before)
      }
    });
    return { ok: true, database: { id: db.id, name: db.name }, results };
  }

  static async stats(appId: string, databaseId: string) {
    const db = await assertDatabaseAccessible(databaseId, appId);
    const filePath = await resolveDatabasePath(db.filename);
    const sizeBytes = Number(sqlFileSize(filePath));
    const handle = openSqlite(filePath, true);
    try {
      const tableCount = (handle.prepare(
        "select count(*) as count from sqlite_master where type = 'table' and name not like 'sqlite_%'"
      ).get() as { count: number }).count;
      return { sizeBytes, tableCount, lastAccessAt: db.lastAccessAt };
    } finally {
      handle.close();
    }
  }

  static async listTables(appId: string, databaseId: string) {
    await assertDatabaseAccessible(databaseId, appId);
    const db = await prisma.appDatabase.findUnique({ where: { id: databaseId } });
    if (!db) throw new ApiError("DATABASE_NOT_FOUND");
    const handle = openSqlite(await resolveDatabasePath(db.filename), true);
    try {
      const tables = handle
        .prepare("select name, sql from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name")
        .all() as Array<{ name: string; sql: string | null }>;
      return { tables };
    } finally {
      handle.close();
    }
  }

  static async tableDetail(appId: string, databaseId: string, table: string) {
    await assertDatabaseAccessible(databaseId, appId);
    validateIdentifier(table, "table");
    const db = await prisma.appDatabase.findUnique({ where: { id: databaseId } });
    if (!db) throw new ApiError("DATABASE_NOT_FOUND");
    const handle = openSqlite(await resolveDatabasePath(db.filename), true);
    try {
      const columns = handle.prepare(`pragma table_info(${quoteIdentifier(table)})`).all();
      const indexes = handle.prepare(`pragma index_list(${quoteIdentifier(table)})`).all();
      return { columns, indexes };
    } finally {
      handle.close();
    }
  }

  static async listRows(input: {
    appId: string;
    databaseId: string;
    table: string;
    limit?: number;
    offset?: number;
  }) {
    await assertDatabaseAccessible(input.databaseId, input.appId);
    validateIdentifier(input.table, "table");
    const db = await prisma.appDatabase.findUnique({ where: { id: input.databaseId } });
    if (!db) throw new ApiError("DATABASE_NOT_FOUND");
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 500);
    const offset = Math.max(input.offset ?? 0, 0);
    const handle = openSqlite(await resolveDatabasePath(db.filename), true);
    try {
      const table = quoteIdentifier(input.table);
      const rows = coerceRows(handle.prepare(`select rowid as _rowid_, * from ${table} limit ? offset ?`).all(limit, offset));
      const total = (handle.prepare(`select count(*) as count from ${table}`).get() as { count: number }).count;
      return { rows, total, limit, offset };
    } finally {
      handle.close();
    }
  }

  static async insertRow(input: {
    appId: string;
    databaseId: string;
    table: string;
    data: Record<string, unknown>;
    actorUserId?: string | null;
  }) {
    await assertDatabaseAccessible(input.databaseId, input.appId);
    validateIdentifier(input.table, "table");
    const columns = Object.keys(input.data).map((column) => validateIdentifier(column, "column"));
    if (columns.length === 0) throw new ApiError("DATABASE_SQL_INVALID");
    const sql = `insert into ${quoteIdentifier(input.table)} (${columns.map(quoteIdentifier).join(", ")}) values (${columns
      .map((column) => `@${column}`)
      .join(", ")})`;
    return this.executeQuery({
      appId: input.appId,
      databaseId: input.databaseId,
      sql,
      params: input.data,
      mode: "write",
      actorUserId: input.actorUserId
    });
  }

  static async updateRow(input: {
    appId: string;
    databaseId: string;
    table: string;
    rowid: number;
    data: Record<string, unknown>;
    actorUserId?: string | null;
  }) {
    await assertDatabaseAccessible(input.databaseId, input.appId);
    validateIdentifier(input.table, "table");
    const columns = Object.keys(input.data).map((column) => validateIdentifier(column, "column"));
    if (columns.length === 0) throw new ApiError("DATABASE_SQL_INVALID");
    const sql = `update ${quoteIdentifier(input.table)} set ${columns
      .map((column) => `${quoteIdentifier(column)} = @${column}`)
      .join(", ")} where rowid = @rowid`;
    return this.executeQuery({
      appId: input.appId,
      databaseId: input.databaseId,
      sql,
      params: { ...input.data, rowid: input.rowid },
      mode: "write",
      actorUserId: input.actorUserId
    });
  }

  static async deleteRow(input: {
    appId: string;
    databaseId: string;
    table: string;
    rowid: number;
    actorUserId?: string | null;
  }) {
    await assertDatabaseAccessible(input.databaseId, input.appId);
    validateIdentifier(input.table, "table");
    return this.executeQuery({
      appId: input.appId,
      databaseId: input.databaseId,
      sql: `delete from ${quoteIdentifier(input.table)} where rowid = ?`,
      params: [input.rowid],
      mode: "write",
      actorUserId: input.actorUserId
    });
  }

  static async migrateDataTypeToDatabase(input: {
    appId: string;
    dataType: string;
    databaseId: string;
    tableName?: string;
    actorUserId?: string | null;
  }) {
    const existingBinding = await getActiveBinding(input.appId, input.dataType);
    if (existingBinding?.storageKind === "external_sql") {
      throw new ApiError("DATA_STORAGE_EXTERNAL_SQL", { details: existingBinding });
    }
    const db = await assertDatabaseAccessible(input.databaseId, input.appId);
    const tableName = validateIdentifier(input.tableName ?? input.dataType.replace(/[^A-Za-z0-9_]/g, "_"), "table");
    const schema = await prisma.dataSchema.findUnique({
      where: { appId_dataType: { appId: input.appId, dataType: input.dataType } },
      include: { versions: { where: { isActive: 1 }, take: 1 } }
    });
    const activeSchema = schema?.versions[0];
    const extraColumns = columnsFromSchema(safeParseJson(activeSchema?.jsonSchema));
    const columnDefs = [
      ...MAIN_TABLE_BASE_COLUMNS,
      ...extraColumns.map((column) => `${quoteIdentifier(column.name)} ${sqliteTypeForJsonSchema(column.type)}`)
    ];
    const records = await prisma.record.findMany({
      where: { appId: input.appId, dataType: input.dataType },
      orderBy: { createdAt: "asc" }
    });

    const filePath = await resolveDatabasePath(db.filename);
    const before = sqlFileSize(filePath);
    const handle = openSqlite(filePath);
    try {
      const table = quoteIdentifier(tableName);
      handle.prepare(`create table if not exists ${table} (${columnDefs.join(", ")})`).run();
      const existingCount = (handle.prepare(`select count(*) as count from ${table}`).get() as { count: number }).count;
      if (existingCount > 0) {
        throw new ApiError("DATABASE_SQL_INVALID", { details: { reason: "target table is not empty" } });
      }
      const columns = [
        "id",
        "owner_id",
        "created_at",
        "updated_at",
        "deleted_at",
        "data_json",
        ...extraColumns.map((column) => column.name)
      ];
      const insert = handle.prepare(
        `insert into ${table} (${columns.map(quoteIdentifier).join(", ")}) values (${columns
          .map((column) => `@${column}`)
          .join(", ")})`
      );
      const tx = handle.transaction(() => {
        for (const record of records) {
          const data = safeParseJson(record.data);
          const obj = plainObject(data);
          const row: Record<string, unknown> = {
            id: record.id,
            owner_id: record.ownerId,
            created_at: record.createdAt,
            updated_at: record.updatedAt,
            deleted_at: record.deletedAt,
            data_json: JSON.stringify(data ?? null)
          };
          for (const column of extraColumns) {
            row[column.name] = valueForSqlite(obj[column.name], column.type);
          }
          insert.run(row);
        }
      });
      tx();
    } finally {
      handle.close();
    }

    const t = now();
    const binding = await prisma.dataStorageBinding.upsert({
      where: { appId_dataType: { appId: input.appId, dataType: input.dataType } },
      create: {
        appId: input.appId,
        dataType: input.dataType,
        storageKind: "external_sql",
        databaseId: db.id,
        tableName,
        migratedAt: t,
        createdAt: t,
        updatedAt: t
      },
      update: {
        storageKind: "external_sql",
        databaseId: db.id,
        tableName,
        migratedAt: t,
        updatedAt: t
      }
    });
    const after = sqlFileSize(filePath);
    await applyStorageDelta(input.appId, before, after);
    AuditService.log({
      appId: input.appId,
      userId: input.actorUserId ?? null,
      action: "data.storage.migrate_to_database",
      resourceType: "data_storage_binding",
      resourceId: binding.id,
      after: {
        dataType: input.dataType,
        databaseId: db.id,
        tableName,
        records: records.length,
        storageDelta: Number(after - before)
      }
    });
    return { binding, database: { id: db.id, name: db.name }, tableName, records: records.length };
  }

  static async assertMainStorageWritable(input: {
    appId: string;
    dataType: string;
    data: unknown;
    recordId?: string;
  }) {
    const binding = await getActiveBinding(input.appId, input.dataType);
    if (binding?.storageKind === "external_sql") {
      throw new ApiError("DATA_STORAGE_EXTERNAL_SQL", { details: binding });
    }

    const systemConfig = await getSystemConfig();
    const records = await prisma.record.findMany({
      where: { appId: input.appId, deletedAt: null },
      select: { id: true, data: true }
    });
    const creating = !input.recordId || !records.some((record) => record.id === input.recordId);
    const nextCount = records.length + (creating ? 1 : 0);
    if (nextCount > systemConfig.defaultMainRecordLimit) {
      throw new ApiError("DATA_STORAGE_MAIN_LIMIT_EXCEEDED", {
        details: { limit: systemConfig.defaultMainRecordLimit, count: nextCount }
      });
    }
    const currentBytes = records.reduce((sum, record) => sum + Buffer.byteLength(record.data, "utf8"), 0);
    const previousBytes = input.recordId
      ? Buffer.byteLength(records.find((record) => record.id === input.recordId)?.data ?? "", "utf8")
      : 0;
    const nextBytes = currentBytes - previousBytes + jsonByteLength(input.data);
    if (nextBytes > systemConfig.defaultMainStorageBytes) {
      throw new ApiError("DATA_STORAGE_MAIN_LIMIT_EXCEEDED", {
        details: { limitBytes: systemConfig.defaultMainStorageBytes, bytes: nextBytes }
      });
    }
  }

  static async assertMainStorageReadable(appId: string, dataType: string) {
    const binding = await getActiveBinding(appId, dataType);
    if (binding?.storageKind === "external_sql") {
      throw new ApiError("DATA_STORAGE_EXTERNAL_SQL", { details: binding });
    }
  }
}
