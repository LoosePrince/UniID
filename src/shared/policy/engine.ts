/**
 * PolicyEngine — 统一权限决策入口。
 *
 * - evaluate：返回单次 allow/deny。
 * - explain：返回可展示给控制台模拟器的决策路径。
 * - filterReadable：按字段权限收缩返回数据。
 */

import {
  normalizePolicyDocuments,
  type PolicyAction,
  type PolicyCondition,
  type PolicyDocument,
  type PolicyRule
} from "./document";
import { matchFieldPath } from "./wildcard";
import { evaluateStaticVariable, type AuthContext } from "./variables";
import { checkDynamicPermission } from "./dynamic";

export interface PolicyDecision {
  allow: boolean;
  reason: string;
  matchedPerm?: string;
  matchedPattern?: string;
  matchedRuleId?: string;
}

export interface EvaluateInput {
  /** 已合并好的多层 PolicyDocument（按 app → dataType → record 顺序传入）。 */
  documents: Array<PolicyDocument | string | null | undefined>;
  action: PolicyAction;
  /** 字段路径（如 "data.likes"）；不传则按整条记录评估。 */
  fieldPath?: string;
  /** 写入值（用于动态权限和 check）。 */
  dataValue?: unknown;
  /** 持久化值（用于 using 和动态 diff）。 */
  currentValue?: unknown;
}

interface RuleMatchDetail {
  rule: PolicyRule;
  matchedPerm?: string;
  matchedPattern?: string;
}

interface EvalTraceStep {
  step: string;
  detail: unknown;
}

const WRITE_FALLBACK_ACTIONS: PolicyAction[] = [
  "create",
  "update",
  "increment",
  "push",
  "set",
  "unset"
];

function shortcircuitCtx(ctx: AuthContext): PolicyDecision | null {
  if (ctx.systemAdmin) return { allow: true, reason: "system-admin" };
  if (ctx.userId && ctx.ownerId === ctx.userId) return { allow: true, reason: "owner" };
  if (ctx.authType === "full" && ctx.appAdmin) return { allow: true, reason: "app-admin" };
  return null;
}

function actionMatches(rule: PolicyRule, action: PolicyAction): boolean {
  if (rule.actions.includes(action)) return true;
  return WRITE_FALLBACK_ACTIONS.includes(action) && rule.actions.includes("write");
}

function fieldMatches(rule: PolicyRule, fieldPath?: string): { match: boolean; pattern?: string } {
  const fields = rule.resource?.fields;
  if (!fields || fields.length === 0) return { match: true };
  if (!fieldPath) return { match: false };

  let best: { pattern: string; depth: number } | null = null;
  for (const pattern of fields) {
    if (!matchFieldPath(pattern, fieldPath)) continue;
    const depth = pattern.split(".").length - (pattern.endsWith(".*") ? 1 : 0);
    if (!best || depth > best.depth) best = { pattern, depth };
  }

  return best ? { match: true, pattern: best.pattern } : { match: false };
}

function evaluateSubject(
  subjects: string[],
  ctx: AuthContext,
  input: EvaluateInput
): { allow: boolean; matchedPerm?: string } {
  for (const subject of subjects) {
    const result = evaluateStaticVariable(subject, ctx);
    if (result === "match") return { allow: true, matchedPerm: subject };
    if (result === "dynamic" && input.fieldPath && ctx.userId) {
      const dynamicAllowed = checkDynamicPermission({
        perm: subject,
        fieldPath: input.fieldPath,
        dataValue: input.dataValue,
        currentValue: input.currentValue,
        userId: ctx.userId
      });
      if (dynamicAllowed) return { allow: true, matchedPerm: subject };
    }
  }
  return { allow: false };
}

function readPath(value: unknown, path: string): unknown {
  const parts = path.split(".");
  let cursor: unknown = value;

  for (const part of parts) {
    if (cursor == null || typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }

  return cursor;
}

function buildConditionSource(input: EvaluateInput, ctx: AuthContext, phase: "using" | "check") {
  const data = phase === "check" ? input.dataValue : input.currentValue;
  return {
    userId: ctx.userId,
    role: ctx.role,
    systemAdmin: ctx.systemAdmin,
    appAdmin: ctx.appAdmin,
    appId: ctx.appId,
    authType: ctx.authType,
    ownerId: ctx.ownerId,
    origin: ctx.origin,
    functionName: ctx.functionName,
    data
  };
}

function resolveExpected(value: unknown, ctx: AuthContext): unknown {
  if (value === "$userId") return ctx.userId;
  if (value === "$role") return ctx.role;
  if (value === "$appId") return ctx.appId;
  if (value === "$authType") return ctx.authType;
  if (value === "$ownerId") return ctx.ownerId;
  if (Array.isArray(value)) return value.map((item) => resolveExpected(item, ctx));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, resolveExpected(v, ctx)])
    );
  }
  return value;
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function evaluateCondition(
  condition: PolicyCondition | null | undefined,
  input: EvaluateInput,
  ctx: AuthContext,
  phase: "using" | "check"
): { allow: boolean; failures: Array<{ path: string; actual: unknown; expected: unknown }> } {
  if (!condition || Object.keys(condition).length === 0) return { allow: true, failures: [] };
  const source = buildConditionSource(input, ctx, phase);
  const failures: Array<{ path: string; actual: unknown; expected: unknown }> = [];

  for (const [path, expectedRaw] of Object.entries(condition)) {
    const expected = resolveExpected(expectedRaw, ctx);
    const actual = readPath(source, path);
    if (!sameValue(actual, expected)) failures.push({ path, actual, expected });
  }

  return { allow: failures.length === 0, failures };
}

function relevantRules(input: EvaluateInput): { rules: PolicyRule[]; legacyOnly: boolean } {
  const { document, legacyOnly } = normalizePolicyDocuments(input.documents);
  return {
    legacyOnly,
    rules: document.rules.filter((rule) => rule.effect === "allow" && actionMatches(rule, input.action))
  };
}

function evaluateRules(input: EvaluateInput, ctx: AuthContext, trace?: EvalTraceStep[]): PolicyDecision {
  const normalized = relevantRules(input);
  trace?.push({ step: "normalized-document", detail: normalized });

  for (const rule of normalized.rules) {
    const field = fieldMatches(rule, input.fieldPath);
    trace?.push({ step: "rule-field", detail: { ruleId: rule.id, field } });
    if (!field.match) continue;

    const subject = evaluateSubject(rule.subjects, ctx, input);
    trace?.push({ step: "rule-subject", detail: { ruleId: rule.id, subject } });
    if (!subject.allow) continue;

    const usingResult = evaluateCondition(rule.using, input, ctx, "using");
    trace?.push({ step: "rule-using", detail: { ruleId: rule.id, using: usingResult } });
    if (!usingResult.allow) continue;

    const checkResult = evaluateCondition(rule.check, input, ctx, "check");
    trace?.push({ step: "rule-check", detail: { ruleId: rule.id, check: checkResult } });
    if (!checkResult.allow) continue;

    const reason = field.pattern ? "field-permission" : "default-permission";
    const detail: RuleMatchDetail = {
      rule,
      matchedPerm: subject.matchedPerm,
      matchedPattern: field.pattern
    };
    trace?.push({ step: "rule-allow", detail });

    return {
      allow: true,
      reason,
      matchedPerm: subject.matchedPerm,
      matchedPattern: field.pattern,
      matchedRuleId: rule.id
    };
  }

  return { allow: false, reason: "no-match" };
}

function filterValueByReadablePaths(
  value: unknown,
  path: string,
  documents: EvaluateInput["documents"],
  ctx: AuthContext
): unknown {
  if (value == null || typeof value !== "object") {
    const decision = PolicyEngine.evaluate({ documents, action: "read", fieldPath: path }, ctx);
    return decision.allow ? value : undefined;
  }

  if (Array.isArray(value)) {
    const items = value
      .map((item, index) => filterValueByReadablePaths(item, `${path}.${index}`, documents, ctx))
      .filter((item) => item !== undefined);
    return items.length > 0 ? items : undefined;
  }

  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    const direct = PolicyEngine.evaluate({ documents, action: "read", fieldPath: childPath }, ctx);
    if (direct.allow) {
      out[key] = child;
      continue;
    }
    const nested = filterValueByReadablePaths(child, childPath, documents, ctx);
    if (nested !== undefined) out[key] = nested;
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

export class PolicyEngine {
  static evaluate(input: EvaluateInput, ctx: AuthContext): PolicyDecision {
    const sc = shortcircuitCtx(ctx);
    if (sc) return sc;
    return evaluateRules(input, ctx);
  }

  static explain(input: EvaluateInput, ctx: AuthContext): {
    decision: PolicyDecision;
    trace: EvalTraceStep[];
  } {
    const trace: EvalTraceStep[] = [];
    const sc = shortcircuitCtx(ctx);
    if (sc) {
      trace.push({ step: "shortcut", detail: sc });
      return { decision: sc, trace };
    }

    const decision = evaluateRules(input, ctx, trace);
    trace.push({ step: "decision", detail: decision });
    return { decision, trace };
  }

  static filterReadable(
    data: Record<string, unknown>,
    documents: EvaluateInput["documents"],
    ctx: AuthContext
  ): Record<string, unknown> {
    if (ctx.systemAdmin || (ctx.userId && ctx.ownerId === ctx.userId)) return data;
    if (ctx.authType === "full" && ctx.appAdmin) return data;

    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const path = `data.${key}`;
      const direct = this.evaluate({ documents, action: "read", fieldPath: path }, ctx);
      if (direct.allow) {
        out[key] = value;
        continue;
      }
      const nested = filterValueByReadablePaths(value, path, documents, ctx);
      if (nested !== undefined) out[key] = nested;
    }
    return out;
  }
}