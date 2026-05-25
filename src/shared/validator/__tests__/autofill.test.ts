import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { applyAutoFill, parseAutoFill, type AutoFillContext } from "../autofill";

const baseCtx: AutoFillContext = {
  userId: "u1",
  role: "user",
  systemAdmin: false,
  appAdmin: false,
  appId: "app1",
  authType: "full",
  ownerId: "u1",
  origin: "sdk",
  ip: "127.0.0.1",
  requestId: "req_abc",
  sessionId: "sess1"
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("applyAutoFill", () => {
  it("fills $serverTime + $userId on create", () => {
    const rec: { data: Record<string, unknown> } = { data: {} };
    applyAutoFill(rec, { "data.createdAt": "$serverTime", "data.authorId": "$userId" }, baseCtx, "create");
    expect(rec.data["createdAt"]).toBe(Math.floor(new Date("2026-01-01T00:00:00Z").getTime() / 1000));
    expect(rec.data["authorId"]).toBe("u1");
  });

  it("does not overwrite existing field on update", () => {
    const rec: { data: Record<string, unknown> } = { data: { authorId: "u-original" } };
    applyAutoFill(rec, { "data.authorId": "$userId" }, baseCtx, "update");
    expect(rec.data["authorId"]).toBe("u-original");
  });

  it("update overwrites missing field but not existing", () => {
    const rec: { data: Record<string, unknown> } = { data: {} };
    applyAutoFill(rec, { "data.updatedAt": "$serverTime" }, baseCtx, "update");
    expect(rec.data["updatedAt"]).toBeDefined();
  });

  it("literal default only filled on create", () => {
    const rec: { data: Record<string, unknown> } = { data: {} };
    applyAutoFill(rec, { "data.version": 1 }, baseCtx, "create");
    expect(rec.data["version"]).toBe(1);

    const rec2: { data: Record<string, unknown> } = { data: {} };
    applyAutoFill(rec2, { "data.version": 1 }, baseCtx, "update");
    expect(rec2.data["version"]).toBeUndefined();
  });

  it("nested paths are created", () => {
    const rec: { data: Record<string, unknown> } = { data: {} };
    applyAutoFill(rec, { "data.meta.ip": "$ip", "data.meta.req": "$requestId" }, baseCtx, "create");
    expect(rec.data["meta"]).toEqual({ ip: "127.0.0.1", req: "req_abc" });
  });
});

describe("parseAutoFill", () => {
  it("parses valid JSON", () => {
    expect(parseAutoFill('{"data.x":"$userId"}')).toEqual({ "data.x": "$userId" });
  });

  it("returns undefined on null/empty", () => {
    expect(parseAutoFill(null)).toBeUndefined();
    expect(parseAutoFill("")).toBeUndefined();
    expect(parseAutoFill(undefined)).toBeUndefined();
  });

  it("returns undefined on invalid JSON", () => {
    expect(parseAutoFill("not json")).toBeUndefined();
  });

  it("returns undefined on non-object", () => {
    expect(parseAutoFill("[1,2,3]")).toBeUndefined();
    expect(parseAutoFill("123")).toBeUndefined();
  });
});
