import type {
  BusinessCondition,
  BusinessDecisionTrace,
  BusinessRuleTraceStep,
  CommandContext,
  MutationRuleDocument,
  MutationRuleOperation
} from "@/shared/business";

function cloneObject(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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

function normalizeDataPath(path: string): string {
  return path.startsWith("data.") ? path.slice("data.".length) : path;
}

function readDataPath(value: unknown, path: string): unknown {
  return readPath(value, normalizeDataPath(path));
}

function exists(value: unknown): boolean {
  return value !== undefined && value !== null;
}

function writePath(target: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".").filter(Boolean);
  let cursor = target;
  for (const part of parts.slice(0, -1)) {
    const current = cursor[part];
    if (!current || typeof current !== "object" || Array.isArray(current)) cursor[part] = {};
    cursor = cursor[part] as Record<string, unknown>;
  }
  const leaf = parts[parts.length - 1];
  if (leaf) cursor[leaf] = value;
}

function deletePath(target: Record<string, unknown>, path: string) {
  const parts = path.split(".").filter(Boolean);
  let cursor: unknown = target;
  for (const part of parts.slice(0, -1)) {
    if (!cursor || typeof cursor !== "object") return;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  const leaf = parts[parts.length - 1];
  if (leaf && cursor && typeof cursor === "object") delete (cursor as Record<string, unknown>)[leaf];
}

function pathEventMatches(pattern: string, changedPath: string): boolean {
  const [pathPattern, action] = splitEvent(pattern);
  const [changedPattern, changedAction] = splitEvent(changedPath);
  if (action && changedAction && action !== changedAction) return false;
  const patternParts = pathPattern.split(".");
  const changedParts = changedPattern.split(".");
  if (patternParts.length !== changedParts.length) return false;
  return patternParts.every((part, index) => part === "*" || part === changedParts[index]);
}

function splitEvent(value: string): [string, string | null] {
  const parts = value.split(".");
  const last = parts[parts.length - 1];
  if (last === "set" || last === "unset" || last === "increment" || last === "push" || last === "create" || last === "update" || last === "delete") {
    return [parts.slice(0, -1).join("."), last];
  }
  return [value, null];
}

function resolveAction(map: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split(".").filter(Boolean);
  for (let i = parts.length; i > 0; i--) {
    const key = parts.slice(0, i).join(".");
    if (typeof map[key] === "string") return map[key] as string;
  }
  return undefined;
}

function changedEvents(ctx: CommandContext): string[] {
  const mutationActions = asObject(ctx.intent.metadata?.mutationActions);
  if (Object.keys(mutationActions).length > 0) {
    return Object.entries(mutationActions).map(([path, action]) => `${path}.${action}`);
  }

  const policyActions = asObject(ctx.intent.metadata?.policyActions);
  return (ctx.changeSet?.changedPaths ?? []).map((path) => {
    const action = resolveAction(policyActions, path) ?? ctx.intent.kind;
    return `${path}.${action}`;
  });
}

function conditionSource(ctx: CommandContext, matchedPath?: string) {
  const before = ctx.changeSet?.before ?? null;
  const after = ctx.changeSet?.after ?? null;
  const beforeValue = matchedPath ? readDataPath(before, matchedPath) : before;
  const afterValue = matchedPath ? readDataPath(after, matchedPath) : after;
  return {
    actor: ctx.actor,
    intent: ctx.intent,
    before,
    after,
    changeSet: ctx.changeSet,
    data: after,
    event: matchedPath
      ? {
          path: matchedPath,
          before: beforeValue,
          after: afterValue,
          exists: {
            before: exists(beforeValue),
            after: exists(afterValue)
          }
        }
      : null,
    exists: {
      before: exists(beforeValue),
      after: exists(afterValue)
    }
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

function sameValue(a: unknown, b: unknown): boolean {
  if (a == null && b == null) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

function readConditionPath(source: ReturnType<typeof conditionSource>, path: string): unknown {
  if (path === "before.exists") return source.exists.before;
  if (path === "after.exists") return source.exists.after;
  if (path === "before.value") return source.event?.before;
  if (path === "after.value") return source.event?.after;
  return readPath(source, path);
}

function evaluateCondition(condition: BusinessCondition | null | undefined, ctx: CommandContext, matchedPath?: string) {
  if (!condition || Object.keys(condition).length === 0) return { allow: true, failures: [] };
  const source = conditionSource(ctx, matchedPath);
  const failures: Array<{ path: string; actual: unknown; expected: unknown }> = [];
  for (const [path, expectedRaw] of Object.entries(condition)) {
    const expected = resolveExpected(expectedRaw, ctx);
    const actual = readConditionPath(source, path);
    if (!sameValue(actual, expected)) failures.push({ path, actual, expected });
  }
  return { allow: failures.length === 0, failures };
}

function applyOperation(data: Record<string, unknown>, op: MutationRuleOperation) {
  const path = normalizeDataPath(op.path);
  switch (op.type) {
    case "set":
      writePath(data, path, op.value);
      break;
    case "unset":
      deletePath(data, path);
      break;
    case "increment": {
      const current = readPath(data, path);
      writePath(data, path, (typeof current === "number" ? current : 0) + op.by);
      break;
    }
    case "push": {
      const current = readPath(data, path);
      const next = Array.isArray(current) ? [...current] : [];
      if (!op.uniq || !next.some((item) => sameValue(item, op.value))) next.push(op.value);
      writePath(data, path, next);
      break;
    }
  }
}

export interface MutationRuleApplyResult {
  data: Record<string, unknown>;
  appliedRules: string[];
  trace: BusinessRuleTraceStep[];
}

export class MutationRuleEngine {
  static explain(rules: MutationRuleDocument[], ctx: CommandContext): BusinessDecisionTrace {
    const result = this.apply(rules, ctx);
    return {
      allow: true,
      reason: result.appliedRules.length > 0 ? "mutation-rules-applied" : "no-mutation-rule",
      steps: result.trace
    };
  }

  static apply(rules: MutationRuleDocument[], ctx: CommandContext): MutationRuleApplyResult {
    const base = asObject(ctx.changeSet?.after);
    const data = cloneObject(base);
    const events = changedEvents(ctx);
    const appliedRules: string[] = [];
    const trace: BusinessRuleTraceStep[] = [{ step: "changed-events", detail: events }];

    for (const rule of rules) {
      const matchedEvents = events
        .map((event) => ({ event, path: splitEvent(event)[0] }))
        .filter(({ event }) => rule.on.some((pattern) => pathEventMatches(pattern, event)));
      trace.push({ step: "rule-event", ruleId: rule.id, detail: { matched: matchedEvents.length > 0, events: matchedEvents.map((item) => item.event) } });
      if (matchedEvents.length === 0) continue;

      for (const matchedEvent of matchedEvents) {
        const condition = evaluateCondition(rule.when, ctx, matchedEvent.path);
        trace.push({ step: "rule-condition", ruleId: rule.id, detail: { event: matchedEvent.event, ...condition } });
        if (!condition.allow) continue;

        for (const op of rule.then) applyOperation(data, op);
        appliedRules.push(rule.id);
        trace.push({ step: "rule-applied", ruleId: rule.id, detail: { event: matchedEvent.event, operations: rule.then } });
      }
    }

    return { data, appliedRules, trace };
  }
}