import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/shared/prisma", () => ({
  prisma: {
    workflowDocument: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    }
  }
}));

import { prisma } from "@/shared/prisma";
import { WorkflowService } from "../service";

const workflowDocument = prisma.workflowDocument as unknown as Record<"findMany" | "findFirst" | "create" | "update", Mock>;

const workflow = {
  version: 1 as const,
  id: "article-publish-flow",
  dataType: "article",
  stateField: "data.status",
  transitions: [{ id: "submit", from: "draft", to: "reviewing", action: "submit", subjects: ["$owner"] }]
};

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "row_1",
    appId: "app1",
    scope: "dataType",
    target: "article",
    workflowId: workflow.id,
    document: JSON.stringify(workflow),
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

describe("WorkflowService", () => {
  it("upserts workflow documents independently", async () => {
    workflowDocument.findFirst.mockResolvedValue(null);
    workflowDocument.create.mockImplementation(async ({ data }) => row(data));

    const result = await WorkflowService.upsert("app1", { scope: "dataType", target: "article", document: workflow }, "u1");

    expect(workflowDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          appId: "app1",
          scope: "dataType",
          target: "article",
          workflowId: "article-publish-flow",
          isActive: 1
        })
      })
    );
    expect(result.workflow.document.id).toBe("article-publish-flow");
  });

  it("loads active workflows by scope chain", async () => {
    workflowDocument.findMany.mockResolvedValue([
      row({ scope: "record", target: "rec1" }),
      row({ scope: "app", target: null }),
      row({ scope: "dataType", target: "article" })
    ]);

    const workflows = await WorkflowService.loadActiveWorkflows("app1", "article", "rec1");

    expect(workflowDocument.findMany).toHaveBeenCalledWith({
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
    expect(workflows.map((item) => item.id)).toEqual([
      "article-publish-flow",
      "article-publish-flow",
      "article-publish-flow"
    ]);
  });
});