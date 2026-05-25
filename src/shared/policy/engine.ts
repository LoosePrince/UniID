/**
 * PolicyEngine — 统一权限决策入口。
 *
 *   evaluate({ documents, action, fieldPath?, dataValue?, currentValue? }, ctx)
 *     → { allow: boolean, reason: string }
 *
 *   explain(...)
 *     → 完整决策追踪（用于控制台权限模拟器）
 *
 *   filterReadable(data, documents, ctx)
 *     → 仅返回有 read 权限的字段子集
 */

import {
  parsePolicyDocument,
  mergePolicy,
  type PolicyDocument,
  type PolicyAction,
  type PolicyBlock
} from "./document";
import { findMostSpecificFieldMatch } from "./wildcard";
import { evaluateStaticVariable, type AuthContext } from "./variables";
import { checkDynamicPermission } from "./dynamic";

export interface PolicyDecision {
  allow: boolean;
  reason: string;
  matchedPerm?: string;
  matchedPattern?: string;
}

export interface EvaluateInput {
  /** 已合并好的多层 PolicyDocument（按 app → dataType → record 顺序传入）。 */
  documents: Array<PolicyDocument | string | null | undefined>;
  action: PolicyAction;
  /** 字段路径（如 "data.likes"）；不传则只看 default block。 */
  fieldPath?: string;
  /** 写入值（用于动态权限）。 */
  dataValue?: unknown;
  /** 持久化值（用于 diff，动态权限使用）。 */
  currentValue?: unknown;
}

/** create/update/increment/push 兜底到 write 块。 */
function effectivePerms(block: PolicyBlock | undefined, action: PolicyAction): string[] | null {
  if (!block) return null;
  const direct = block[action];
  if (direct && direct.length > 0) return direct;
  if (["create", "update", "increment", "push"].includes(action) && block.write) {
    return block.write;
  }
  return null;
}

function mergeAndParse(docs: EvaluateInput["documents"]): PolicyDocument {
  const parsed = docs.map((d) => (d == null ? {} : parsePolicyDocument(d)));
  return mergePolicy(...parsed);
}

function shortcircuitCtx(
  action: PolicyAction,
  ctx: AuthContext
): PolicyDecision | null {
  // 系统管理员直通（所有 action）
  if (ctx.systemAdmin) {
    return { allow: true, reason: "system-admin" };
  }
  // 资源所有者直通
  if (ctx.userId && ctx.ownerId === ctx.userId) {
    return { allow: true, reason: "owner" };
  }
  // 完整授权下：应用管理员直通；限制授权不直通
  if (ctx.authType === "full" && ctx.appAdmin) {
    return { allow: true, reason: "app-admin" };
  }
  return null;
}

/** 评估一个权限列表。 */
function evaluatePerms(
  perms: string[],
  action: PolicyAction,
  ctx: AuthContext,
  dynamicInput?: { fieldPath: string; dataValue: unknown; currentValue: unknown }
): { allow: boolean; matchedPerm?: string } {
  for (const perm of perms) {
    const r = evaluateStaticVariable(perm, ctx);
    if (r === "match") return { allow: true, matchedPerm: perm };
    if (r === "dynamic" && dynamicInput && ctx.userId) {
      if (
        checkDynamicPermission({
          perm,
          fieldPath: dynamicInput.fieldPath,
          dataValue: dynamicInput.dataValue,
          currentValue: dynamicInput.currentValue,
          userId: ctx.userId
        })
      ) {
        return { allow: true, matchedPerm: perm };
      }
    }
  }
  return { allow: false };
}

export class PolicyEngine {
  /** 单次决策。 */
  static evaluate(input: EvaluateInput, ctx: AuthContext): PolicyDecision {
    const sc = shortcircuitCtx(input.action, ctx);
    if (sc) return sc;

    const doc = mergeAndParse(input.documents);

    // 字段级（最具体匹配优先）
    if (input.fieldPath && doc.fields) {
      const match = findMostSpecificFieldMatch(doc.fields, input.fieldPath);
      if (match) {
        const perms = effectivePerms(match.value, input.action);
        if (perms) {
          const result = evaluatePerms(perms, input.action, ctx, {
            fieldPath: input.fieldPath,
            dataValue: input.dataValue,
            currentValue: input.currentValue
          });
          if (result.allow) {
            return {
              allow: true,
              reason: "field-permission",
              matchedPerm: result.matchedPerm,
              matchedPattern: match.pattern
            };
          }
          // 字段命中但未匹配，继续看 default block 作为兜底（限制授权下 default 仅生效 $public/$all）
        }
      }
    }

    // default block
    const defaultPerms = effectivePerms(doc.default, input.action);
    if (defaultPerms) {
      const result = evaluatePerms(defaultPerms, input.action, ctx);
      if (result.allow) {
        return {
          allow: true,
          reason: "default-permission",
          matchedPerm: result.matchedPerm
        };
      }
    }

    return { allow: false, reason: "no-match" };
  }

  /**
   * 解释模式：保留决策路径以供控制台权限模拟器展示。
   */
  static explain(input: EvaluateInput, ctx: AuthContext): {
    decision: PolicyDecision;
    trace: Array<{ step: string; detail: unknown }>;
  } {
    const trace: Array<{ step: string; detail: unknown }> = [];
    const sc = shortcircuitCtx(input.action, ctx);
    if (sc) {
      trace.push({ step: "shortcut", detail: sc });
      return { decision: sc, trace };
    }

    const doc = mergeAndParse(input.documents);
    trace.push({ step: "merged-document", detail: doc });

    if (input.fieldPath && doc.fields) {
      const match = findMostSpecificFieldMatch(doc.fields, input.fieldPath);
      trace.push({ step: "field-match", detail: match });
      if (match) {
        const perms = effectivePerms(match.value, input.action);
        trace.push({ step: "field-perms", detail: perms });
        if (perms) {
          const result = evaluatePerms(perms, input.action, ctx, {
            fieldPath: input.fieldPath,
            dataValue: input.dataValue,
            currentValue: input.currentValue
          });
          trace.push({ step: "field-eval", detail: result });
          if (result.allow) {
            return {
              decision: {
                allow: true,
                reason: "field-permission",
                matchedPerm: result.matchedPerm,
                matchedPattern: match.pattern
              },
              trace
            };
          }
        }
      }
    }

    const defaultPerms = effectivePerms(doc.default, input.action);
    trace.push({ step: "default-perms", detail: defaultPerms });
    if (defaultPerms) {
      const result = evaluatePerms(defaultPerms, input.action, ctx);
      trace.push({ step: "default-eval", detail: result });
      if (result.allow) {
        return {
          decision: {
            allow: true,
            reason: "default-permission",
            matchedPerm: result.matchedPerm
          },
          trace
        };
      }
    }

    return { decision: { allow: false, reason: "no-match" }, trace };
  }

  /**
   * 过滤字段：仅返回当前 ctx 有 read 权限的字段子集。
   * 注意：仅顶层（`data.<key>`）粒度过滤；嵌套对象内仍可被读到。
   */
  static filterReadable(
    data: Record<string, unknown>,
    documents: EvaluateInput["documents"],
    ctx: AuthContext
  ): Record<string, unknown> {
    if (ctx.systemAdmin || (ctx.userId && ctx.ownerId === ctx.userId)) return data;
    if (ctx.authType === "full" && ctx.appAdmin) return data;

    const out: Record<string, unknown> = {};
    for (const key of Object.keys(data)) {
      const decision = this.evaluate(
        { documents, action: "read", fieldPath: `data.${key}` },
        ctx
      );
      if (decision.allow) out[key] = data[key];
    }
    return out;
  }
}
