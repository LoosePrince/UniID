import { describe, expect, it } from "vitest";
import { MutationRuleEngine } from "../mutation-engine";
import type { CommandContext, MutationRuleDocument } from "../types";

function command(changes: Array<{ path: string; action: "set" | "unset" }>, before: Record<string, unknown>, after: Record<string, unknown>): CommandContext {
  return {
    actor: {
      userId: "user_a",
      role: "user",
      systemAdmin: false,
      appAdmin: false,
      appId: "app1",
      authType: "full",
      ownerId: "author_1",
      origin: "sdk"
    },
    intent: {
      kind: "fieldOps",
      appId: "app1",
      dataType: "article",
      recordId: "rec1",
      metadata: {
        mutationActions: Object.fromEntries(changes.map(({ path, action }) => [path, action]))
      }
    },
    changeSet: {
      before,
      submitted: after,
      after,
      changedPaths: changes.map(({ path }) => path)
    }
  };
}

const likeUp: MutationRuleDocument = {
  version: 1,
  id: "article-like-count-up",
  dataType: "article",
  on: ["data.likes.*.set"],
  when: { "before.likes.user_a": null, "after.likes.user_a.likedAt": 1710000000 },
  then: [{ type: "increment", path: "data.likeCount", by: 1 }]
};

const likeDown: MutationRuleDocument = {
  version: 1,
  id: "article-like-count-down",
  dataType: "article",
  on: ["data.likes.*.unset"],
  when: { "after.likes.user_a": null },
  then: [{ type: "increment", path: "data.likeCount", by: -1 }]
};

const genericLikeUp: MutationRuleDocument = {
  version: 1,
  id: "article-generic-like-count-up",
  dataType: "article",
  on: ["data.likes.*.set"],
  when: { "before.exists": false, "after.exists": true },
  then: [{ type: "increment", path: "data.likeCount", by: 1 }]
};

const genericLikeDown: MutationRuleDocument = {
  version: 1,
  id: "article-generic-like-count-down",
  dataType: "article",
  on: ["data.likes.*.unset"],
  when: { "before.exists": true, "after.exists": false },
  then: [{ type: "increment", path: "data.likeCount", by: -1 }]
};

describe("MutationRuleEngine", () => {
  it("increments likeCount when user likes for the first time", () => {
    const before = { likeCount: 0, likes: {} };
    const after = { likeCount: 0, likes: { user_a: { likedAt: 1710000000 } } };

    const result = MutationRuleEngine.apply([likeUp], command([{ path: "data.likes.user_a", action: "set" }], before, after));

    expect(result.appliedRules).toEqual(["article-like-count-up"]);
    expect(result.data.likeCount).toBe(1);
  });

  it("decrements likeCount when user unlikes", () => {
    const before = { likeCount: 1, likes: { user_a: { likedAt: 1710000000 } } };
    const after = { likeCount: 1, likes: {} };

    const result = MutationRuleEngine.apply([likeDown], command([{ path: "data.likes.user_a", action: "unset" }], before, after));

    expect(result.appliedRules).toEqual(["article-like-count-down"]);
    expect(result.data.likeCount).toBe(0);
  });

  it("evaluates before/after exists against the matched changed field", () => {
    const before = { likeCount: 2, likes: { user_a: { likedAt: 1710000000 } } };
    const after = {
      likeCount: 2,
      likes: {
        user_a: { likedAt: 1710000000 },
        user_b: { likedAt: 1710000100 }
      }
    };

    const result = MutationRuleEngine.apply([genericLikeUp], command([{ path: "data.likes.user_b", action: "set" }], before, after));

    expect(result.appliedRules).toEqual(["article-generic-like-count-up"]);
    expect(result.data.likeCount).toBe(3);
  });

  it("uses matched field existence for generic unlike rules", () => {
    const before = {
      likeCount: 2,
      likes: {
        user_a: { likedAt: 1710000000 },
        user_b: { likedAt: 1710000100 }
      }
    };
    const after = { likeCount: 2, likes: { user_a: { likedAt: 1710000000 } } };

    const result = MutationRuleEngine.apply([genericLikeDown], command([{ path: "data.likes.user_b", action: "unset" }], before, after));

    expect(result.appliedRules).toEqual(["article-generic-like-count-down"]);
    expect(result.data.likeCount).toBe(1);
  });

  it("skips rules when changed event does not match", () => {
    const result = MutationRuleEngine.apply(
      [likeUp],
      command([{ path: "data.title", action: "set" }], { likeCount: 0, likes: {} }, { likeCount: 0, likes: {}, title: "hello" })
    );

    expect(result.appliedRules).toEqual([]);
    expect(result.data.likeCount).toBe(0);
  });

  it("returns explain trace", () => {
    const trace = MutationRuleEngine.explain(
      [likeUp],
      command([{ path: "data.likes.user_a", action: "set" }], { likeCount: 0, likes: {} }, { likeCount: 0, likes: { user_a: { likedAt: 1710000000 } } })
    );

    expect(trace.allow).toBe(true);
    expect(trace.reason).toBe("mutation-rules-applied");
    expect(trace.steps.some((step) => step.step === "rule-applied")).toBe(true);
  });
});