import { ApiError } from "@/shared/errors";

export type SqlMode = "auto" | "read" | "write";
export type SqlParams = unknown[] | Record<string, unknown>;

export interface SqlStatementInput {
  sql: string;
  params?: SqlParams;
  mode?: SqlMode;
}

const DISALLOWED_WORDS = new Set(["attach", "detach"]);

function isIdentStart(ch: string) {
  return /[A-Za-z_]/.test(ch);
}

function isIdentPart(ch: string) {
  return /[A-Za-z0-9_]/.test(ch);
}

export function normalizeSql(sql: string): string {
  return sql
    .replace(/`([^`]*)`/g, (_m, name: string) => `"${name.replace(/"/g, '""')}"`)
    .replace(/\bbigserial\b/gi, "integer")
    .replace(/\bserial\b/gi, "integer")
    .replace(/\bboolean\b/gi, "integer")
    .replace(/\btrue\b/gi, "1")
    .replace(/\bfalse\b/gi, "0")
    .replace(/\bcurrent_timestamp\s*\(\s*\)/gi, "CURRENT_TIMESTAMP")
    .replace(/\bnow\s*\(\s*\)/gi, "CURRENT_TIMESTAMP")
    .replace(/\bauto_increment\b/gi, "autoincrement")
    .replace(/\s+returning\s+\*\s*;?\s*$/i, "")
    .trim();
}

export function splitSqlStatements(sql: string): string[] {
  const out: string[] = [];
  let start = 0;
  let quote: "'" | '"' | "`" | null = null;
  let lineComment = false;
  let blockComment = false;

  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i]!;
    const next = sql[i + 1];

    if (lineComment) {
      if (ch === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === "*" && next === "/") {
        blockComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (ch === quote) {
        if (next === quote) {
          i += 1;
        } else {
          quote = null;
        }
      } else if (ch === "\\" && quote !== "`") {
        i += 1;
      }
      continue;
    }

    if (ch === "-" && next === "-") {
      lineComment = true;
      i += 1;
      continue;
    }
    if (ch === "/" && next === "*") {
      blockComment = true;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === ";") {
      const statement = sql.slice(start, i).trim();
      if (statement) out.push(statement);
      start = i + 1;
    }
  }

  const tail = sql.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

function sqlTokens(sql: string): string[] {
  const tokens: string[] = [];
  let quote: "'" | '"' | "`" | null = null;
  let lineComment = false;
  let blockComment = false;

  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i]!;
    const next = sql[i + 1];

    if (lineComment) {
      if (ch === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === "*" && next === "/") {
        blockComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (ch === quote) {
        if (next === quote) i += 1;
        else quote = null;
      } else if (ch === "\\" && quote !== "`") {
        i += 1;
      }
      continue;
    }
    if (ch === "-" && next === "-") {
      lineComment = true;
      i += 1;
      continue;
    }
    if (ch === "/" && next === "*") {
      blockComment = true;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      continue;
    }
    if (isIdentStart(ch)) {
      let end = i + 1;
      while (end < sql.length && isIdentPart(sql[end]!)) end += 1;
      tokens.push(sql.slice(i, end).toLowerCase());
      i = end - 1;
    }
  }

  return tokens;
}

export function assertSqlSafe(sql: string): void {
  const tokens = sqlTokens(sql);
  for (const token of tokens) {
    if (DISALLOWED_WORDS.has(token)) {
      throw new ApiError("DATABASE_SQL_FORBIDDEN", {
        details: { reason: `${token.toUpperCase()} is not allowed` }
      });
    }
  }

  for (let i = 0; i < tokens.length; i += 1) {
    if (tokens[i] === "vacuum" && tokens[i + 1] === "into") {
      throw new ApiError("DATABASE_SQL_FORBIDDEN", {
        details: { reason: "VACUUM INTO is not allowed" }
      });
    }
    if (tokens[i] === "pragma" && tokens[i + 1] === "writable_schema") {
      throw new ApiError("DATABASE_SQL_FORBIDDEN", {
        details: { reason: "PRAGMA writable_schema is not allowed" }
      });
    }
    if (tokens[i] === "load_extension") {
      throw new ApiError("DATABASE_SQL_FORBIDDEN", {
        details: { reason: "load_extension() is not allowed" }
      });
    }
  }
}

export function normalizeStatement(input: SqlStatementInput): Required<SqlStatementInput> {
  const statements = splitSqlStatements(input.sql).map(normalizeSql).filter(Boolean);
  if (statements.length !== 1) {
    throw new ApiError("DATABASE_SQL_INVALID", {
      details: { reason: "Each statement must contain exactly one SQL statement" }
    });
  }
  return {
    sql: statements[0]!,
    params: input.params ?? [],
    mode: input.mode ?? "auto"
  };
}

export function validateIdentifier(value: string, kind = "identifier"): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new ApiError("DATABASE_SQL_INVALID", { details: { reason: `${kind} is invalid` } });
  }
  return value;
}

export function quoteIdentifier(value: string): string {
  validateIdentifier(value);
  return `"${value.replace(/"/g, '""')}"`;
}

