import type {
  BusinessCondition,
  BusinessDecisionTrace,
  BusinessRuleTraceStep,
  CommandContext,
  WorkflowDocument,
  WorkflowTransition
} from "@/shared/business";
import { evaluateStaticVariable, type AuthContext } from "@/shared/policy";

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeDataPath(path: string): string {
  return path.startsWith("data.") ? path.slice("data.".length) : path;
}

function readPath(value: unknown, path: string): unknown {
  const parts = path.split(".").filter(Boolean);
  let cursor: unknown = value;
  for (const part of parts) {
    if (cursor == null || typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a == null && b == null) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

function stateValue(data: unknown, stateField: string): unknown {
  return readPath(data, normalizeDataPath(stateField));
}

function includesStateChange(ctx: CommandContext, workflow: WorkflowDocument): boolean {
  const before = stateValue(ctx.changeSet?.before, workflow.stateField);
  const after = stateValue(ctx.changeSet?.after, workflow.stateField);
  return !sameValue(before, after);
}

function fromMatches(from: string | string[], value: unknown): boolean {
  const states = Array.isArray(from) ? from : [from];
  return states.some((state) => sameValue(state, value));
}

function actorForPolicy(ctx: CommandContext): AuthContext {
  return {
    userId: ctx.actor.userId,
    role: ctx.actor.role,
    systemAdmin: ctx.actor.systemAdmin,
    appAdmin: ctx.actor.appAdmin,
    appId: ctx.actor.appId,
    authType: ctx.actor.authType,
    ownerId: ctx.actor.ownerId,
    origin: ctx.actor.origin === "function" || ctx.actor.origin === "system" ? ctx.actor.origin : "system",
    functionName: ctx.actor.functionName
  };
}

function subjectsAllow(subjects: string[] | undefined, ctx: CommandContext): boolean {
  if (!subjects || subjects.length === 0) return true;
  const actor = actorForPolicy(ctx);
  return subjects.some((subject) => evaluateStaticVariable(subject, actor) === "match");
}

function source(ctx: CommandContext) {
  return {
    actor: ctx.actor,
    intent: ctx.intent,
    before: ctx.changeSet?.before ?? null,
    after: ctx.changeSet?.after ?? null,
    data: ctx.changeSet?.after ?? null,
    changeSet: ctx.changeSet
  };
}

function resolveExpected(value: unknown, ctx: CommandContext): unknown {
  if (value === "$userId") return ctx.actor.userId;
  if (value === "$role") return ctx.actor.role;
  if (value === "$appId") return ctx.actor.appId;
  if (value === "$authType") return ctx.actor.authType;
  if (value === "$ownerId") return ctx.actor.ownerId;
  if (Array.isArray(value)) return value.map((item) => resolveExpected(item, ctx));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, resolveExpected(item, ctx)]));
  }
  return value;
}

function evaluateCondition(condition: BusinessCondition | null | undefined, ctx: CommandContext) {
  if (!condition || Object.keys(condition).length === 0) return { allow: true, failures: [] };
  const values = source(ctx);
  const failures: Array<{ path: string; actual: unknown; expected: unknown }> = [];
  for (const [path, expectedRaw] of Object.entries(condition)) {
    const expected = resolveExpected(expectedRaw, ctx);
    const actual = readPath(values, path);
    if (!sameValue(actual, expected)) failures.push({ path, actual, expected });
  }
  return { allow: failures.length === 0, failures };
}

function transitionMatches(workflow: WorkflowDocument, transition: WorkflowTransition, ctx: CommandContext): boolean {
  const before = stateValue(ctx.changeSet?.before, workflow.stateField);
  const after = stateValue(ctx.changeSet?.after, workflow.stateField);
  return transition.action === ctx.intent.transition && fromMatches(transition.from, before) && sameValue(transition.to, after);
}

export interface WorkflowEvaluateResult extends BusinessDecisionTrace {
  workflowId?: string;
  transitionId?: string;
}

export class WorkflowEngine {
  static evaluate(workflows: WorkflowDocument[], ctx: CommandContext): WorkflowEvaluateResult {
    const relevant = workflows.filter((workflow) => workflow.dataType === ctx.intent.dataType || workflow.dataType === "*");
    const changed = relevant.filter((workflow) => includesStateChange(ctx, workflow));
    const steps: BusinessRuleTraceStep[] = [
      { step: "workflow-state-change", detail: changed.map((workflow) => ({ workflowId: workflow.id, stateField: workflow.stateField })) }
    ];

    if (changed.length === 0) return { allow: true, reason: "no-state-change", steps };
    if (!ctx.intent.transition) return { allow: false, reason: "transition-required", steps };

    for (const workflow of changed) {
      for (const transition of workflow.transitions) {
        const matched = transitionMatches(workflow, transition, ctx);
        steps.push({ step: "transition-match", ruleId: workflow.id, detail: { transitionId: transition.id, matched } });
        if (!matched) continue;

        const subjectAllowed = subjectsAllow(transition.subjects, ctx);
        steps.push({ step: "transition-subject", ruleId: workflow.id, detail: { transitionId: transition.id, allow: subjectAllowed } });
        if (!subjectAllowed) continue;

        const using = evaluateCondition(transition.using, ctx);
        steps.push({ step: "transition-using", ruleId: workflow.id, detail: { transitionId: transition.id, using } });
        if (!using.allow) continue;

        const check = evaluateCondition(transition.check, ctx);
        steps.push({ step: "transition-check", ruleId: workflow.id, detail: { transitionId: transition.id, check } });
        if (!check.allow) continue;

        return {
          allow: true,
          reason: "transition-allowed",
          workflowId: workflow.id,
          transitionId: transition.id,
          steps
        };
      }
    }

    return { allow: false, reason: "no-transition-match", steps };
  }
}