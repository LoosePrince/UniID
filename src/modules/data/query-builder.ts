/**
 * 查询 DSL → SQLite (Prisma raw SQL) 翻译器。
 *
 * 支持的 DSL：
 *   where:
 *     { "data.title": "x" }                              // 相等
 *     { "data.likes": { $contains: "u1" } }              // JSON 数组/对象 key 包含
 *     { "data.createdAt": { $gte: 0, $lt: 99 } }
 *     { "data.status": { $in: ["draft","published"] } }
 *     { "data.title": { $startsWith: "intro" } }
 *     { "data.email": { $exists: true } }
 *     { $or: [ {...}, {...} ] }
 *   select: ["title","content"]            // 仅 data.* 顶层字段，全选 → undefined
 *   orderBy: { "data.createdAt": "desc" }
 *   limit: 1..1000
 *   cursor: "<recordId>"                    // 上一次返回的最后一行 id
 *
 * 安全：
 *   - 字段 path 仅允许 `[a-zA-Z0-9_\.]+`，不接受 SQL 片段
 *   - 所有值参数化（Prisma.sql 模板）
 *   - 必须 (appId, dataType) 限定
 *   - 强制 limit ≤ 1000
 */

import { Prisma } from "@prisma/client";
import { ApiError } from "@/shared/errors";

const MAX_LIMIT = 1000;
const PATH_RE = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/;

type Cmp = "$eq" | "$ne" | "$gt" | "$gte" | "$lt" | "$lte";

export interface QueryDSL {
  select?: string[]; // ["title","content"]
  where?: Record<string, unknown>;
  orderBy?: Record<string, "asc" | "desc">;
  limit?: number;
  cursor?: string;
}

function jsonExtract(path: string): Prisma.Sql {
  if (!PATH_RE.test(path)) throw new ApiError("DATA_QUERY_INVALID", { details: { path } });
  // path 形如 "data.title" or "data.likes.uid"
  // 'data' 列存的是顶层 JSON。要 query "data.title" 用 json_extract(data, '$.title')
  // 我们把第一段（必须 "data"）去掉
  const parts = path.split(".");
  if (parts[0] !== "data") {
    // 允许顶层字段（"createdAt"/"updatedAt"/"ownerId"），由调用方区分
    throw new ApiError("DATA_QUERY_INVALID", { details: { path, hint: "must start with 'data.'" } });
  }
  const jsonPath = "$." + parts.slice(1).join(".");
  return Prisma.sql`json_extract("data", ${jsonPath})`;
}

function isTopLevelColumn(path: string): boolean {
  return ["createdAt", "updatedAt", "ownerId", "id"].includes(path);
}

function topLevelColumn(path: string): Prisma.Sql {
  switch (path) {
    case "createdAt":
      return Prisma.sql`"createdAt"`;
    case "updatedAt":
      return Prisma.sql`"updatedAt"`;
    case "ownerId":
      return Prisma.sql`"ownerId"`;
    case "id":
      return Prisma.sql`"id"`;
    default:
      throw new ApiError("DATA_QUERY_INVALID", { details: { path } });
  }
}

function buildLeafCondition(path: string, op: string, value: unknown): Prisma.Sql {
  const left = isTopLevelColumn(path) ? topLevelColumn(path) : jsonExtract(path);

  switch (op) {
    case "$eq":
      return Prisma.sql`${left} = ${value}`;
    case "$ne":
      return Prisma.sql`${left} <> ${value}`;
    case "$gt":
      return Prisma.sql`${left} > ${value}`;
    case "$gte":
      return Prisma.sql`${left} >= ${value}`;
    case "$lt":
      return Prisma.sql`${left} < ${value}`;
    case "$lte":
      return Prisma.sql`${left} <= ${value}`;
    case "$in": {
      if (!Array.isArray(value) || value.length === 0) {
        return Prisma.sql`0 = 1`;
      }
      return Prisma.sql`${left} IN (${Prisma.join(value as (string | number)[])})`;
    }
    case "$exists": {
      const exists = Boolean(value);
      return exists ? Prisma.sql`${left} IS NOT NULL` : Prisma.sql`${left} IS NULL`;
    }
    case "$startsWith": {
      const pattern = `${String(value)}%`;
      return Prisma.sql`${left} LIKE ${pattern}`;
    }
    case "$contains": {
      // 对 JSON 数组/对象使用 json_each
      // 简化实现：用 LIKE 在文本表达上做一次（足够 demo），生产环境可换为 json_each 子查询
      if (isTopLevelColumn(path)) {
        const pattern = `%${String(value)}%`;
        return Prisma.sql`${left} LIKE ${pattern}`;
      }
      const parts = path.split(".").slice(1).join(".");
      const jsonPath = "$." + parts;
      return Prisma.sql`EXISTS (SELECT 1 FROM json_each(json_extract("data", ${jsonPath})) WHERE value = ${value})`;
    }
    default:
      throw new ApiError("DATA_QUERY_INVALID", { details: { op } });
  }
}

function compileCondition(path: string, raw: unknown): Prisma.Sql {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return buildLeafCondition(path, "$eq", raw);
  }
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length === 0) return Prisma.sql`1 = 1`;
  const parts = entries.map(([op, val]) => buildLeafCondition(path, op, val));
  return joinAnd(parts);
}

function joinAnd(parts: Prisma.Sql[]): Prisma.Sql {
  if (parts.length === 0) return Prisma.sql`1 = 1`;
  if (parts.length === 1) return parts[0]!;
  let acc = Prisma.sql`(${parts[0]!})`;
  for (let i = 1; i < parts.length; i++) {
    acc = Prisma.sql`${acc} AND (${parts[i]!})`;
  }
  return acc;
}

function joinOr(parts: Prisma.Sql[]): Prisma.Sql {
  if (parts.length === 0) return Prisma.sql`0 = 1`;
  if (parts.length === 1) return parts[0]!;
  let acc = Prisma.sql`(${parts[0]!})`;
  for (let i = 1; i < parts.length; i++) {
    acc = Prisma.sql`${acc} OR (${parts[i]!})`;
  }
  return acc;
}

function compileWhere(where: Record<string, unknown>): Prisma.Sql {
  const ands: Prisma.Sql[] = [];
  for (const [k, v] of Object.entries(where)) {
    if (k === "$or") {
      if (!Array.isArray(v)) throw new ApiError("DATA_QUERY_INVALID", { details: { op: "$or" } });
      const branches = (v as Record<string, unknown>[]).map((b) => compileWhere(b));
      ands.push(joinOr(branches));
      continue;
    }
    if (k === "$and") {
      if (!Array.isArray(v)) throw new ApiError("DATA_QUERY_INVALID", { details: { op: "$and" } });
      const branches = (v as Record<string, unknown>[]).map((b) => compileWhere(b));
      ands.push(joinAnd(branches));
      continue;
    }
    ands.push(compileCondition(k, v));
  }
  return joinAnd(ands);
}

export interface CompiledQuery {
  sql: Prisma.Sql;
  countSql: Prisma.Sql;
}

export function compileQuery(input: {
  appId: string;
  dataType: string;
  dsl: QueryDSL;
}): CompiledQuery {
  const limit = Math.max(1, Math.min(MAX_LIMIT, input.dsl.limit ?? 50));
  if (limit > MAX_LIMIT) throw new ApiError("DATA_QUERY_LIMIT_EXCEEDED");

  const base = Prisma.sql`SELECT * FROM "Record" WHERE "appId" = ${input.appId} AND "dataType" = ${input.dataType} AND "deletedAt" IS NULL`;
  const cnt = Prisma.sql`SELECT COUNT(*) as cnt FROM "Record" WHERE "appId" = ${input.appId} AND "dataType" = ${input.dataType} AND "deletedAt" IS NULL`;

  let where = Prisma.sql``;
  if (input.dsl.where && Object.keys(input.dsl.where).length > 0) {
    where = Prisma.sql` AND (${compileWhere(input.dsl.where)})`;
  }

  let cursor = Prisma.sql``;
  if (input.dsl.cursor) {
    cursor = Prisma.sql` AND "id" < ${input.dsl.cursor}`;
  }

  let order = Prisma.sql` ORDER BY "createdAt" DESC, "id" DESC`;
  if (input.dsl.orderBy) {
    const items = Object.entries(input.dsl.orderBy);
    if (items.length > 0) {
      const fragments = items.map(([k, dir]) => {
        const col = isTopLevelColumn(k) ? topLevelColumn(k) : jsonExtract(k);
        const directionSql = dir === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
        return Prisma.sql`${col} ${directionSql}`;
      });
      // 拼接 ORDER BY
      let ord = fragments[0]!;
      for (let i = 1; i < fragments.length; i++) {
        ord = Prisma.sql`${ord}, ${fragments[i]!}`;
      }
      order = Prisma.sql` ORDER BY ${ord}`;
    }
  }

  const lim = Prisma.sql` LIMIT ${limit + 1}`;

  return {
    sql: Prisma.sql`${base}${where}${cursor}${order}${lim}`,
    countSql: Prisma.sql`${cnt}${where}`
  };
}
