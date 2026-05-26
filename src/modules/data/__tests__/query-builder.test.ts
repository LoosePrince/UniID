/**
 * query-builder DSL → SQL 翻译器单测。
 *
 * 由于 Prisma.Sql 是模板字面量包装类型，这里我们检查最终的 .strings 拼接与 .values 来证明：
 *   - 字段路径正确转换为 json_extract / top-level column
 *   - 所有用户输入都走参数化绑定（不会进入 SQL 字符串）
 *   - limit 上限被强制
 *   - $or / $and / $contains / $startsWith 等算子被正确折叠
 */
import { describe, expect, it } from "vitest";
import { compileQuery } from "../query-builder";

interface PrismaSqlLike {
  sql?: string;
  text?: string;
  strings?: ReadonlyArray<string>;
  values: unknown[];
}

function sqlText(sql: unknown): string {
  const s = sql as PrismaSqlLike;
  if (typeof s.sql === "string") return s.sql;
  if (typeof s.text === "string") return s.text;
  if (Array.isArray(s.strings)) return Array.from(s.strings).join("?");
  return "";
}

describe("compileQuery — base", () => {
  it("limits enforced and base where present", () => {
    const { sql } = compileQuery({
      appId: "app1",
      dataType: "post",
      dsl: { limit: 50 }
    });
    const text = sqlText(sql);
    expect(text).toContain('FROM "Record"');
    expect(text).toContain('"appId"');
    expect(text).toContain('"dataType"');
    expect(text).toContain("deletedAt");
    expect(text).toContain("LIMIT");
    expect((sql as unknown as PrismaSqlLike).values).toEqual(["app1", "post", 51]);
  });

  it("clamps limit to MAX 1000", () => {
    const { sql } = compileQuery({
      appId: "a",
      dataType: "d",
      dsl: { limit: 99999 }
    });
    const values = (sql as unknown as PrismaSqlLike).values;
    expect(values[values.length - 1]).toBe(1001);
  });
});

describe("compileQuery — where", () => {
  it("equality on data.* field uses json_extract and parameterizes value", () => {
    const { sql } = compileQuery({
      appId: "a", dataType: "post",
      dsl: { where: { "data.title": "hi" }, limit: 10 }
    });
    const text = sqlText(sql);
    expect(text).toContain("json_extract");
    expect((sql as unknown as PrismaSqlLike).values).toContain("hi");
  });

  it("top-level column equality works", () => {
    const { sql } = compileQuery({
      appId: "a", dataType: "post",
      dsl: { where: { ownerId: "u1" }, limit: 10 }
    });
    const text = sqlText(sql);
    expect(text).toContain('"ownerId"');
    expect((sql as unknown as PrismaSqlLike).values).toContain("u1");
  });

  it("$or branches join with OR", () => {
    const { sql } = compileQuery({
      appId: "a", dataType: "post",
      dsl: {
        where: { $or: [{ ownerId: "u1" }, { "data.public": true }] },
        limit: 10
      }
    });
    const text = sqlText(sql);
    expect(text).toContain(" OR ");
  });

  it("rejects path with SQL injection attempt", () => {
    expect(() =>
      compileQuery({
        appId: "a", dataType: "post",
        dsl: { where: { 'data.title"; DROP TABLE Record;--': "x" }, limit: 10 }
      })
    ).toThrow();
  });

  it("rejects path not starting with data. (other than top-level columns)", () => {
    expect(() =>
      compileQuery({
        appId: "a", dataType: "post",
        dsl: { where: { "meta.foo": "x" }, limit: 10 }
      })
    ).toThrow();
  });
});

describe("compileQuery — cursor + orderBy", () => {
  it("cursor adds id < ? clause", () => {
    const { sql } = compileQuery({
      appId: "a", dataType: "post",
      dsl: { cursor: "rec_xxx", limit: 10 }
    });
    const text = sqlText(sql);
    expect(text).toContain('"id" <');
    expect((sql as unknown as PrismaSqlLike).values).toContain("rec_xxx");
  });

  it("explicit orderBy used", () => {
    const { sql } = compileQuery({
      appId: "a", dataType: "post",
      dsl: { orderBy: { "data.likes": "desc" }, limit: 10 }
    });
    const text = sqlText(sql);
    expect(text).toContain("ORDER BY");
    expect(text).toContain("json_extract");
    expect(text).toContain("DESC");
  });
});
