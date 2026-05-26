import { describe, expect, it } from "vitest";
import { WorkflowEngine } from "../workflow-engine";
import type { CommandContext, WorkflowDocument } from "../types";

const articleWorkflow: WorkflowDocument = {
  version: 1,
  id: "article-publish-flow",
  dataType: "article",
  stateField: "data.status",
  transitions: [
    { id: "submit", from: "draft", to: "reviewing", action: "submit", subjects: ["$owner"] },
    { id: "publish", from: "reviewing", to: "published", action: "publish", subjects: ["$app_admin"] }
  ]
};

function command(input: { before: string; after: string; transition?: string; owner?: boolean; appAdmin?: boolean }): CommandContext {
  return {
    actor: {
      userId: "user_a",
      role: "user",
      systemAdmin: false,
      appAdmin: input.appAdmin ?? false,
      appId: "app1",
      authType: "full",
      ownerId: input.owner === false ? "user_b" : "user_a",
      origin: "sdk"
    },
    intent: {
      kind: input.transition ? "transition" : "update",
      appId: "app1",
      dataType: "article",
      recordId: "rec1",
      transition: input.transition
    },
    changeSet: {
      before: { status: input.before },
      submitted: { status: input.after },
      after: { status: input.after },
      changedPaths: ["data.status"]
    }
  };
}

describe("WorkflowEngine", () => {
  it("allows a matched transition", () => {
    const result = WorkflowEngine.evaluate([articleWorkflow], command({ before: "draft", after: "reviewing", transition: "submit" }));

    expect(result.allow).toBe(true);
    expect(result.reason).toBe("transition-allowed");
    expect(result.transitionId).toBe("submit");
  });

  it("denies state changes without transition action", () => {
    const result = WorkflowEngine.evaluate([articleWorkflow], command({ before: "draft", after: "reviewing" }));

    expect(result.allow).toBe(false);
    expect(result.reason).toBe("transition-required");
  });

  it("denies transition when subject does not match", () => {
    const result = WorkflowEngine.evaluate([articleWorkflow], command({ before: "draft", after: "reviewing", transition: "submit", owner: false }));

    expect(result.allow).toBe(false);
    expect(result.reason).toBe("no-transition-match");
  });

  it("allows non-state updates", () => {
    const result = WorkflowEngine.evaluate([
      articleWorkflow
    ], {
      ...command({ before: "draft", after: "draft" }),
      changeSet: {
        before: { status: "draft", title: "a" },
        submitted: { title: "b" },
        after: { status: "draft", title: "b" },
        changedPaths: ["data.title"]
      }
    });

    expect(result.allow).toBe(true);
    expect(result.reason).toBe("no-state-change");
  });
});