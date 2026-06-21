import { describe, expect, it } from "vitest";
import { ApiError } from "@/shared/errors";
import { generateDatabaseKey, hashDatabaseKey, isDatabaseKey } from "../key";
import { assertSqlSafe, normalizeSql, normalizeStatement, splitSqlStatements } from "../sql";
import { resolveDatabasePath } from "../service";

describe("database keys", () => {
  it("generates Lsqlite-compatible one-time secrets and hashes them", () => {
    const generated = generateDatabaseKey();
    expect(generated.plain).toMatch(/^lsq_[A-Za-z0-9_-]{32}$/);
    expect(isDatabaseKey(generated.plain)).toBe(true);
    expect(generated.hash).toBe(hashDatabaseKey(generated.plain));
    expect(generated.hash).not.toContain(generated.plain);
  });
});

describe("SQL helpers", () => {
  it("splits SQL without cutting quoted semicolons", () => {
    expect(splitSqlStatements("select ';'; select 1;")).toEqual(["select ';'", "select 1"]);
  });

  it("normalizes common PostgreSQL-ish syntax for SQLite", () => {
    expect(normalizeSql("create table `t` (id serial, ok boolean default true);")).toBe(
      'create table "t" (id integer, ok integer default 1);'
    );
    expect(normalizeSql("insert into t values (now()) returning *")).toBe(
      "insert into t values (CURRENT_TIMESTAMP)"
    );
  });

  it("rejects multi statements where one statement is expected", () => {
    expect(() => normalizeStatement({ sql: "select 1; select 2" })).toThrow(ApiError);
  });

  it("blocks dangerous Lsqlite-compatible external SQL", () => {
    expect(() => assertSqlSafe("attach database 'x' as y")).toThrow(ApiError);
    expect(() => assertSqlSafe("detach database y")).toThrow(ApiError);
    expect(() => assertSqlSafe("vacuum into 'copy.db'")).toThrow(ApiError);
    expect(() => assertSqlSafe("pragma writable_schema = 1")).toThrow(ApiError);
    expect(() => assertSqlSafe("select load_extension('x')")).toThrow(ApiError);
  });
});

describe("database paths", () => {
  it("rejects path traversal filenames", async () => {
    await expect(resolveDatabasePath("../escape.sqlite")).rejects.toBeInstanceOf(ApiError);
    await expect(resolveDatabasePath("nested/escape.sqlite")).rejects.toBeInstanceOf(ApiError);
  });
});
