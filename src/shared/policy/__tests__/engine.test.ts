import { describe, expect, it } from "vitest";
import { PolicyEngine } from "../engine";
import type { AuthContext } from "../variables";

function ctx(over: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: "u1",
    role: "user",
    systemAdmin: false,
    appAdmin: false,
    appId: "app1",
    authType: "restricted",
    ownerId: null,
    origin: "sdk",
    ...over
  };
}

const publicReadDoc = {
  default: { read: ["$public"], create: ["$owner"], update: ["$owner"], delete: ["$owner"] }
};

describe("PolicyEngine.evaluate — shortcuts", () => {
  it("system admin always allowed", () => {
    const d = PolicyEngine.evaluate(
      { documents: [publicReadDoc], action: "delete" },
      ctx({ systemAdmin: true })
    );
    expect(d.allow).toBe(true);
    expect(d.reason).toBe("system-admin");
  });

  it("owner always allowed", () => {
    const d = PolicyEngine.evaluate(
      { documents: [publicReadDoc], action: "update" },
      ctx({ userId: "u1", ownerId: "u1" })
    );
    expect(d.allow).toBe(true);
    expect(d.reason).toBe("owner");
  });

  it("app admin allowed under full auth", () => {
    const d = PolicyEngine.evaluate(
      { documents: [publicReadDoc], action: "delete" },
      ctx({ appAdmin: true, authType: "full" })
    );
    expect(d.allow).toBe(true);
    expect(d.reason).toBe("app-admin");
  });

  it("app admin NOT auto-allowed under restricted auth", () => {
    const d = PolicyEngine.evaluate(
      { documents: [publicReadDoc], action: "delete" },
      ctx({ appAdmin: true, authType: "restricted" })
    );
    expect(d.allow).toBe(false);
  });
});

describe("PolicyEngine.evaluate — default block", () => {
  it("$public read allowed for anonymous", () => {
    const d = PolicyEngine.evaluate(
      { documents: [publicReadDoc], action: "read" },
      ctx({ userId: null })
    );
    expect(d.allow).toBe(true);
  });

  it("anonymous create denied", () => {
    const d = PolicyEngine.evaluate(
      { documents: [publicReadDoc], action: "create" },
      ctx({ userId: null })
    );
    expect(d.allow).toBe(false);
  });

  it("non-owner update denied by $owner perm", () => {
    const d = PolicyEngine.evaluate(
      { documents: [publicReadDoc], action: "update" },
      ctx({ userId: "u2", ownerId: "u1" })
    );
    expect(d.allow).toBe(false);
  });
});

describe("PolicyEngine.evaluate — variables", () => {
  it("$all matches authenticated user", () => {
    const d = PolicyEngine.evaluate(
      { documents: [{ default: { read: ["$all"] } }], action: "read" },
      ctx({ userId: "u1" })
    );
    expect(d.allow).toBe(true);
  });

  it("$user:{id} matches", () => {
    const d = PolicyEngine.evaluate(
      { documents: [{ default: { read: ["$user:u9"] } }], action: "read" },
      ctx({ userId: "u9" })
    );
    expect(d.allow).toBe(true);
  });

  it("$role:editor matches role", () => {
    const d = PolicyEngine.evaluate(
      { documents: [{ default: { read: ["$role:editor"] } }], action: "read" },
      ctx({ userId: "u1", role: "editor" })
    );
    expect(d.allow).toBe(true);
  });

  it("$role mismatch denies", () => {
    const d = PolicyEngine.evaluate(
      { documents: [{ default: { read: ["$role:editor"] } }], action: "read" },
      ctx({ userId: "u1", role: "user" })
    );
    expect(d.allow).toBe(false);
  });

  it("$function:{name} only when origin=function", () => {
    const doc = { default: { read: ["$function:syncJob"] } };
    expect(
      PolicyEngine.evaluate({ documents: [doc], action: "read" }, ctx({ origin: "function", functionName: "syncJob" })).allow
    ).toBe(true);
    expect(
      PolicyEngine.evaluate({ documents: [doc], action: "read" }, ctx({ origin: "function", functionName: "other" })).allow
    ).toBe(false);
    expect(
      PolicyEngine.evaluate({ documents: [doc], action: "read" }, ctx({ origin: "sdk" })).allow
    ).toBe(false);
  });
});

describe("PolicyEngine.evaluate — field permissions with wildcards", () => {
  const doc = {
    default: { read: ["$public"], create: ["$owner"], update: ["$owner"], delete: ["$owner"] },
    fields: {
      "data.likes.*": {
        read: ["$public"],
        create: ["$dynamic:likes.$user"],
        update: ["$dynamic:likes.$user"],
        delete: ["$dynamic:likes.$user"]
      },
      "data.title": { read: ["$public"], update: ["$app_admin"] }
    }
  };

  it("wildcard child path matches", () => {
    const d = PolicyEngine.evaluate(
      { documents: [doc], action: "read", fieldPath: "data.likes.userA" },
      ctx({ userId: null })
    );
    expect(d.allow).toBe(true);
    expect(d.reason).toBe("field-permission");
  });

  it("dynamic write allowed when key === current user", () => {
    const d = PolicyEngine.evaluate(
      {
        documents: [doc],
        action: "create",
        fieldPath: "data.likes",
        currentValue: {},
        dataValue: { u1: { time: 1 } }
      },
      ctx({ userId: "u1" })
    );
    // 注意: fieldPath 是 "data.likes" 时，dynamic 的 fieldLast='likes' 与 perm 的 'likes.$user' 中第一段对得上
    expect(d.allow).toBe(true);
  });

  it("dynamic write denied when key !== current user", () => {
    const d = PolicyEngine.evaluate(
      {
        documents: [doc],
        action: "create",
        fieldPath: "data.likes",
        currentValue: {},
        dataValue: { other: { time: 1 } }
      },
      ctx({ userId: "u1" })
    );
    expect(d.allow).toBe(false);
  });

  it("most-specific field overrides shorter pattern", () => {
    const d2 = {
      fields: {
        "data.*": { read: ["$owner"] },
        "data.title": { read: ["$public"] }
      }
    };
    const r = PolicyEngine.evaluate(
      { documents: [d2], action: "read", fieldPath: "data.title" },
      ctx({ userId: null })
    );
    expect(r.allow).toBe(true);
  });
});

describe("PolicyEngine.evaluate — write fallback", () => {
  it("create falls back to write block", () => {
    const doc = { default: { write: ["$owner"] } };
    const d = PolicyEngine.evaluate(
      { documents: [doc], action: "create" },
      ctx({ userId: "u1", ownerId: "u1" })
    );
    expect(d.allow).toBe(true);
  });

  it("increment without explicit block falls back to write", () => {
    const doc = { default: { write: ["$all"] } };
    const d = PolicyEngine.evaluate(
      { documents: [doc], action: "increment" },
      ctx({ userId: "u1" })
    );
    expect(d.allow).toBe(true);
  });
});

describe("PolicyEngine.evaluate — document composition", () => {
  it("record-level overrides app-level default", () => {
    const app = { default: { read: ["$owner"] } };
    const record = { default: { read: ["$public"] } };
    const d = PolicyEngine.evaluate(
      { documents: [app, record], action: "read" },
      ctx({ userId: null })
    );
    expect(d.allow).toBe(true);
  });

  it("record-level field overrides dataType-level field", () => {
    const dataType = { fields: { "data.x": { read: ["$owner"] } } };
    const record = { fields: { "data.x": { read: ["$public"] } } };
    const d = PolicyEngine.evaluate(
      { documents: [dataType, record], action: "read", fieldPath: "data.x" },
      ctx({ userId: null })
    );
    expect(d.allow).toBe(true);
  });
});

describe("PolicyEngine.filterReadable", () => {
  it("only returns fields user can read", () => {
    const doc = {
      default: { read: ["$owner"] },
      fields: {
        "data.title": { read: ["$public"] },
        "data.private": { read: ["$owner"] }
      }
    };
    const data = { title: "hi", private: "secret" };
    const r = PolicyEngine.filterReadable(data, [doc], ctx({ userId: null }));
    expect(r).toEqual({ title: "hi" });
  });

  it("owner gets all fields", () => {
    const doc = { default: { read: ["$owner"] } };
    const data = { a: 1, b: 2 };
    const r = PolicyEngine.filterReadable(data, [doc], ctx({ userId: "u1", ownerId: "u1" }));
    expect(r).toEqual(data);
  });
});

describe("PolicyEngine.explain", () => {
  it("returns trace steps", () => {
    const doc = { default: { read: ["$public"] } };
    const { decision, trace } = PolicyEngine.explain(
      { documents: [doc], action: "read" },
      ctx({ userId: null })
    );
    expect(decision.allow).toBe(true);
    expect(trace.length).toBeGreaterThan(0);
  });
});

describe("PolicyEngine.evaluate — string document parsing", () => {
  it("accepts JSON string documents", () => {
    const d = PolicyEngine.evaluate(
      { documents: [JSON.stringify({ default: { read: ["$public"] } })], action: "read" },
      ctx({ userId: null })
    );
    expect(d.allow).toBe(true);
  });

  it("invalid JSON string treated as empty", () => {
    const d = PolicyEngine.evaluate(
      { documents: ["{ not json"], action: "read" },
      ctx({ userId: null })
    );
    expect(d.allow).toBe(false);
  });
});
