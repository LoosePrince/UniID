import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/shared/prisma", () => ({
  prisma: {
    policyDocument: {
      findMany: vi.fn()
    },
    mutationRuleDocument: {
      findMany: vi.fn()
    },
    workflowDocument: {
      findMany: vi.fn()
    }
  }
}));

vi.mock("@/modules/schema", () => ({
  SchemaService: {
    tryLoadActive: vi.fn()
  }
}));

vi.mock("@/shared/bus", () => ({
  bus: {
    publish: vi.fn()
  }
}));

vi.mock("@/shared/sandbox", () => ({
  runSandbox: vi.fn()
}));

vi.mock("../repository", () => ({
  RecordRepository: {
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn()
  }
}));

import { prisma } from "@/shared/prisma";
import { SchemaService } from "@/modules/schema";
import { RecordRepository } from "../repository";
import { DataPipeline } from "../pipeline";

const policyDocument = prisma.policyDocument as unknown as { findMany: Mock };
const mutationRuleDocument = prisma.mutationRuleDocument as unknown as { findMany: Mock };
const workflowDocument = prisma.workflowDocument as unknown as { findMany: Mock };
const schemaService = SchemaService as unknown as { tryLoadActive: Mock };
const recordRepository = RecordRepository as unknown as {
  findById: Mock;
  create: Mock;
  update: Mock;
};

const actor = {
  userId: "user_a",
  role: "user",
  systemAdmin: false,
  appAdmin: false,
  appId: "app1",
  authType: "full" as const,
  ownerId: null,
  origin: "sdk" as const
};

beforeEach(() => {
  vi.clearAllMocks();
  mutationRuleDocument.findMany.mockResolvedValue([]);
  workflowDocument.findMany.mockResolvedValue([]);
  schemaService.tryLoadActive.mockResolvedValue({
    id: "schema_v1",
    jsonSchema: {
      type: "object",
      additionalProperties: true,
      properties: {
        title: { type: "string" },
        likes: { type: "object", additionalProperties: true },
        likeCount: { type: "number" },
        status: { type: "string" }
      }
    },
    autoFill: null,
    validationRules: null
  });
});

describe("DataPipeline mutation rules", () => {
  it("derives likeCount from user-owned likes field operation", async () => {
    policyDocument.findMany.mockResolvedValue([
      {
        document: JSON.stringify({
          version: 2,
          rules: [
            {
              id: "owner-can-set-likes",
              actions: ["set"],
              subjects: ["$owner"],
              resource: { fields: ["data.likes"] }
            }
          ]
        }),
        scope: "dataType"
      }
    ]);
    mutationRuleDocument.findMany.mockResolvedValue([
      {
        document: JSON.stringify({
          version: 1,
          id: "article-like-count-up",
          dataType: "article",
          on: ["data.likes.*.set"],
          when: {
            "before.likes.user_a": null,
            "after.likes.user_a.likedAt": 1710000000
          },
          then: [{ type: "increment", path: "data.likeCount", by: 1 }]
        }),
        scope: "dataType",
        ruleId: "article-like-count-up"
      }
    ]);
    recordRepository.findById.mockResolvedValue({
      id: "rec1",
      appId: "app1",
      dataType: "article",
      ownerId: "user_a",
      data: { title: "hello", likes: {}, likeCount: 0 },
      schemaVersionId: "schema_v1",
      createdAt: 1,
      updatedAt: 1,
      createdById: "user_a",
      updatedById: "user_a"
    });
    recordRepository.update.mockImplementation(async ({ data }) => ({
      id: "rec1",
      appId: "app1",
      dataType: "article",
      ownerId: "user_a",
      data,
      schemaVersionId: "schema_v1",
      createdAt: 1,
      updatedAt: 2,
      createdById: "user_a",
      updatedById: "user_a"
    }));

    const result = await DataPipeline.execute(
      {
        op: "update",
        appId: "app1",
        dataType: "article",
        recordId: "rec1",
        data: { title: "hello", likes: { user_a: { likedAt: 1710000000 } }, likeCount: 0 },
        merge: false,
        policyActions: { "data.likes": "set" },
        mutationActions: { "data.likes.user_a": "set" }
      },
      { actor }
    );

    expect(result.record.data).toMatchObject({
      title: "hello",
      likes: { user_a: { likedAt: 1710000000 } },
      likeCount: 1
    });
    expect(recordRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ likeCount: 1 })
      })
    );
    expect(result.command.changeSet?.changedPaths).toContain("data.likeCount");
  });

  it("rejects direct state changes when workflow requires a transition", async () => {
    policyDocument.findMany.mockResolvedValue([
      {
        document: JSON.stringify({
          version: 2,
          rules: [{ id: "owner-can-update", actions: ["update"], subjects: ["$owner"] }]
        }),
        scope: "dataType"
      }
    ]);
    workflowDocument.findMany.mockResolvedValue([
      {
        document: JSON.stringify({
          version: 1,
          id: "article-publish-flow",
          dataType: "article",
          stateField: "data.status",
          transitions: [{ id: "submit", from: "draft", to: "reviewing", action: "submit", subjects: ["$owner"] }]
        }),
        scope: "dataType",
        workflowId: "article-publish-flow"
      }
    ]);
    recordRepository.findById.mockResolvedValue({
      id: "rec1",
      appId: "app1",
      dataType: "article",
      ownerId: "user_a",
      data: { title: "hello", status: "draft" },
      schemaVersionId: "schema_v1",
      createdAt: 1,
      updatedAt: 1,
      createdById: "user_a",
      updatedById: "user_a"
    });

    await expect(
      DataPipeline.execute(
        {
          op: "update",
          appId: "app1",
          dataType: "article",
          recordId: "rec1",
          data: { title: "hello", status: "reviewing" },
          merge: false
        },
        { actor }
      )
    ).rejects.toMatchObject({ code: "BUSINESS_WORKFLOW_FORBIDDEN" });
  });

  it("allows state changes through a declared workflow transition", async () => {
    policyDocument.findMany.mockResolvedValue([
      {
        document: JSON.stringify({
          version: 2,
          rules: [{ id: "owner-can-update", actions: ["update"], subjects: ["$owner"] }]
        }),
        scope: "dataType"
      }
    ]);
    workflowDocument.findMany.mockResolvedValue([
      {
        document: JSON.stringify({
          version: 1,
          id: "article-publish-flow",
          dataType: "article",
          stateField: "data.status",
          transitions: [{ id: "submit", from: "draft", to: "reviewing", action: "submit", subjects: ["$owner"] }]
        }),
        scope: "dataType",
        workflowId: "article-publish-flow"
      }
    ]);
    recordRepository.findById.mockResolvedValue({
      id: "rec1",
      appId: "app1",
      dataType: "article",
      ownerId: "user_a",
      data: { title: "hello", status: "draft" },
      schemaVersionId: "schema_v1",
      createdAt: 1,
      updatedAt: 1,
      createdById: "user_a",
      updatedById: "user_a"
    });
    recordRepository.update.mockImplementation(async ({ data }) => ({
      id: "rec1",
      appId: "app1",
      dataType: "article",
      ownerId: "user_a",
      data,
      schemaVersionId: "schema_v1",
      createdAt: 1,
      updatedAt: 2,
      createdById: "user_a",
      updatedById: "user_a"
    }));

    const result = await DataPipeline.execute(
      {
        op: "update",
        appId: "app1",
        dataType: "article",
        recordId: "rec1",
        data: { title: "hello", status: "reviewing" },
        merge: false,
        transition: "submit"
      },
      { actor }
    );

    expect(result.record.data).toMatchObject({ status: "reviewing" });
    expect(result.command.intent.kind).toBe("transition");
  });
});