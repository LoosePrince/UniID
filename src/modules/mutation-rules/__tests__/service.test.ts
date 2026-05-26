import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/shared/prisma", () => ({
  prisma: {
    mutationRuleDocument: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    }
  }
}));

import { prisma } from "@/shared/prisma";
import { MutationRuleService } from "../service";

const mutationRuleDocument = prisma.mutationRuleDocument as unknown as Record<"findMany" | "findFirst" | "create" | "update", Mock>;

const rule = {
  version: 1 as const,
  id: "article-like-count-up",
  dataType: "article",
  on: ["data.likes.*.set"],
  when: { "before.likes.user_a": null },
  then: [{ type: "increment" as const, path: "data.likeCount", by: 1 }]
};

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "row_1",
    appId: "app1",
    scope: "dataType",
    target: "article",
    ruleId: rule.id,
    document: JSON.stringify(rule),
    description: null,
    isActive: 1,
    createdAt: 1,
    updatedAt: 1,
    createdById: "u1",
    ...overrides
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MutationRuleService", () => {
  it("upserts rule documents independently from policy documents", async () => {
    mutationRuleDocument.findFirst.mockResolvedValue(null);
    mutationRuleDocument.create.mockImplementation(async ({ data }) => row(data));

    const result = await MutationRuleService.upsert(
      "app1",
      {
        scope: "dataType",
        target: "article",
        document: rule
      },
      "u1"
    );

    expect(mutationRuleDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          appId: "app1",
          scope: "dataType",
          target: "article",
          ruleId: "article-like-count-up",
          isActive: 1
        })
      })
    );
    expect(result.rule.document.id).toBe("article-like-count-up");
  });

  it("loads active rules by app, dataType and record scope chain", async () => {
    mutationRuleDocument.findMany.mockResolvedValue([
      row({ scope: "record", target: "rec1", ruleId: "record-rule" }),
      row({ scope: "app", target: null, ruleId: "app-rule" }),
      row({ scope: "dataType", target: "article", ruleId: "type-rule" })
    ]);

    const rules = await MutationRuleService.loadActiveRules("app1", "article", "rec1");

    expect(mutationRuleDocument.findMany).toHaveBeenCalledWith({
      where: {
        appId: "app1",
        isActive: 1,
        OR: [
          { scope: "app", target: null },
          { scope: "dataType", target: "article" },
          { scope: "record", target: "rec1" }
        ]
      }
    });
    expect(rules.map((item) => item.id)).toEqual([
      "article-like-count-up",
      "article-like-count-up",
      "article-like-count-up"
    ]);
  });

  it("rejects dataType scope without target", async () => {
    await expect(
      MutationRuleService.upsert("app1", { scope: "dataType", target: null, document: rule }, "u1")
    ).rejects.toMatchObject({ code: "BUSINESS_INVALID_RULE" });
  });
});