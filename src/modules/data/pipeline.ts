/**
 * DataPipeline — 写入数据的统一流水线。
 *
 *   1. 解析 policy 文档（app + dataType + record-override 顺序）
 *   2. 加载 active schema（如不存在且策略未启用 schemaless，拒绝）
 *   3. autofill（$serverTime/$userId/...，仅 create 强制覆盖）
 *   4. AJV JSON Schema 校验（fail 则 VALIDATION_FAILED）
 *   5. 自定义 validationRules（QuickJS 沙箱执行）—— M6 接入；当前为 no-op
 *   6. PolicyEngine 字段级校验：对所有发生变化的字段路径判定
 *   7. RecordRepository 持久化
 *   8. bus.emit record.created / updated
 */

import type { AuthContext } from "@/shared/policy/variables";
import type { CommandContext, DataChangeSet, DataCommandIntent } from "@/shared/business";
import { MutationRuleEngine, WorkflowEngine } from "@/shared/business";
import { PolicyEngine, type PolicyAction } from "@/shared/policy";
import { MutationRuleService } from "@/modules/mutation-rules";
import { WorkflowService } from "@/modules/workflows";
import { ApiError } from "@/shared/errors";
import { prisma } from "@/shared/prisma";
import { bus } from "@/shared/bus";
import {
  applyAutoFill,
  compileSchemaCached,
  formatAjvErrors,
  parseAutoFill,
  type AutoFillContext
} from "@/shared/validator";
import { SchemaService } from "@/modules/schema";
import { runSandbox } from "@/shared/sandbox";
import { RecordRepository, type RecordSnapshot } from "./repository";

export type DataPipelineOp = "create" | "update";

export interface DataPipelineInput {
  op: DataPipelineOp;
  appId: string;
  dataType: string;
  /** create 时无 id，update 时必填 */
  recordId?: string;
  ownerId?: string | null;
  /** 用户提交的 data 部分（不含 envelope 字段如 id/appId） */
  data: Record<string, unknown>;
  /** update 时是否合并（默认替换） */
  merge?: boolean;
  /** 字段操作入口可传入 data.<topKey> -> increment/push/set/unset 的动作语义。 */
  policyActions?: Record<string, PolicyAction>;
  mutationActions?: Record<string, string>;
  transition?: string;
  metadata?: Record<string, unknown>;
}

export interface DataPipelineRunCtx {
  actor: AuthContext;
  requestId?: string;
  ip?: string | null;
}

export interface DataPipelineResult {
  record: RecordSnapshot;
  command: CommandContext;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function collectChangedPaths(before: unknown, after: unknown, base = "data"): string[] {
  if (sameValue(before, after)) return [];
  const beforeObj = asObject(before);
  const afterObj = asObject(after);
  const beforeIsObject = before && typeof before === "object" && !Array.isArray(before);
  const afterIsObject = after && typeof after === "object" && !Array.isArray(after);

  if (!beforeIsObject || !afterIsObject) return [base];

  const keys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]);
  const paths: string[] = [];
  for (const key of keys) {
    const childPaths = collectChangedPaths(beforeObj[key], afterObj[key], `${base}.${key}`);
    paths.push(...childPaths);
  }
  return paths;
}

function buildIntent(input: DataPipelineInput): DataCommandIntent {
  const metadata: Record<string, unknown> = { ...(input.metadata ?? {}) };
  if (input.policyActions) metadata.policyActions = input.policyActions;
  if (input.mutationActions) metadata.mutationActions = input.mutationActions;
  return {
    kind: input.transition ? "transition" : input.op,
    appId: input.appId,
    dataType: input.dataType,
    recordId: input.recordId,
    ownerId: input.ownerId,
    data: input.data,
    merge: input.merge,
    transition: input.transition,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined
  };
}

function buildCommandContext(
  input: DataPipelineInput,
  ctx: DataPipelineRunCtx,
  changeSet?: DataChangeSet
): CommandContext {
  return {
    actor: {
      ...ctx.actor,
      requestId: ctx.requestId,
      ip: ctx.ip ?? null
    },
    intent: buildIntent(input),
    changeSet
  };
}

async function loadPolicyDocuments(appId: string, dataType: string, recordId?: string) {
  const where = [
    { scope: "app" as const, target: null as string | null },
    { scope: "dataType" as const, target: dataType },
    ...(recordId ? [{ scope: "record" as const, target: recordId }] : [])
  ];
  const docs = await prisma.policyDocument.findMany({
    where: { appId, OR: where as Array<{ scope: string; target: string | null }> }
  });
  // 按 app → dataType → record 排序（覆盖优先级）
  const orderKey = { app: 0, dataType: 1, record: 2 };
  return docs
    .sort(
      (a, b) =>
        (orderKey as Record<string, number>)[a.scope]! -
        (orderKey as Record<string, number>)[b.scope]!
    )
    .map((d) => d.document);
}

export class DataPipeline {
  static async execute(input: DataPipelineInput, ctx: DataPipelineRunCtx): Promise<DataPipelineResult> {
    // 1) policy 文档
    const docs = await loadPolicyDocuments(input.appId, input.dataType, input.recordId);

    // 2) schema
    const schemaSnap = await SchemaService.tryLoadActive(input.appId, input.dataType);
    if (!schemaSnap) throw new ApiError("SCHEMA_REQUIRED");

    // 3) autofill
    const envelope: { data: Record<string, unknown> } & Record<string, unknown> = {
      data: input.data
    };
    const autoFillSpec = parseAutoFill(schemaSnap.autoFill);
    const autoFillCtx: AutoFillContext = {
      ...ctx.actor,
      requestId: ctx.requestId,
      ip: ctx.ip ?? null,
      sessionId: undefined
    };
    applyAutoFill(envelope, autoFillSpec, autoFillCtx, input.op);

    // 4) JSON Schema
    const validate = compileSchemaCached(schemaSnap.id, schemaSnap.jsonSchema);
    const validateFinalData = (data: Record<string, unknown>) => {
      if (!validate(data)) {
        throw new ApiError("VALIDATION_FAILED", {
          details: { errors: formatAjvErrors(validate.errors) }
        });
      }
    };

    // 5) 自定义 validationRules（QuickJS 沙箱执行）
    //    Schema 维护方可写一个 handler(input, uniid)，input = { op, data, actor, recordId }
    //    handler 返回 { ok: true } 通过；返回 { ok: false, message } 或抛错则拒绝。
    if (schemaSnap.validationRules && schemaSnap.validationRules.trim().length > 0) {
      const sandboxRes = await runSandbox({
        source: schemaSnap.validationRules,
        input: {
          op: input.op,
          data: envelope.data,
          recordId: input.recordId ?? null,
          actor: {
            userId: ctx.actor.userId,
            role: ctx.actor.role,
            appId: ctx.actor.appId,
            authType: ctx.actor.authType
          }
        },
        timeoutMs: 500,
        memoryMb: 32,
        functionName: `schema:${input.dataType}:rules`
      });
      if (sandboxRes.status !== "ok") {
        throw new ApiError("VALIDATION_FAILED", {
          details: {
            stage: "validationRules",
            status: sandboxRes.status,
            error: sandboxRes.error,
            logs: sandboxRes.logs
          }
        });
      }
      const out = sandboxRes.output as { ok?: boolean; message?: string } | null | undefined;
      if (out && out.ok === false) {
        throw new ApiError("VALIDATION_FAILED", {
          details: {
            stage: "validationRules",
            message: out.message ?? "validation rule rejected"
          }
        });
      }
    }

    // 6) PolicyEngine
    let changeSet: DataChangeSet;
    let beforeSnapshot: unknown = null;
    if (input.op === "create") {
      changeSet = {
        before: null,
        submitted: envelope.data,
        after: envelope.data,
        changedPaths: collectChangedPaths(null, envelope.data)
      };
      validateFinalData(envelope.data);
      const actor = {
        ...ctx.actor,
        ownerId: input.ownerId ?? ctx.actor.userId
      };
      const decision = PolicyEngine.evaluate(
        { documents: docs, action: "create", dataValue: envelope.data },
        actor
      );
      if (!decision.allow) {
        throw new ApiError("POLICY_FORBIDDEN", { details: decision });
      }

      for (const [k, value] of Object.entries(envelope.data)) {
        const fieldPath = `data.${k}`;
        const fieldDecision = PolicyEngine.evaluate(
          {
            documents: docs,
            action: "create",
            fieldPath,
            dataValue: value
          },
          actor
        );
        if (!fieldDecision.allow) {
          throw new ApiError("POLICY_FORBIDDEN", {
            details: { fieldPath, decision: fieldDecision }
          });
        }
      }

      const rules = await MutationRuleService.loadActiveRules(input.appId, input.dataType, input.recordId);
      if (rules.length > 0) {
        const mutation = MutationRuleEngine.apply(rules, buildCommandContext(input, ctx, changeSet));
        if (mutation.appliedRules.length > 0) {
          envelope.data = mutation.data;
          changeSet = {
            before: null,
            submitted: changeSet.submitted,
            after: mutation.data,
            changedPaths: collectChangedPaths(null, mutation.data)
          };
          validateFinalData(mutation.data);
        }
      }
    } else {
      if (!input.recordId) throw new ApiError("DATA_RECORD_NOT_FOUND");
      const existing = await RecordRepository.findById(input.recordId);
      if (!existing || existing.appId !== input.appId || existing.dataType !== input.dataType) {
        throw new ApiError("DATA_RECORD_NOT_FOUND");
      }
      const actor = { ...ctx.actor, ownerId: existing.ownerId };
      const currentData = (existing.data ?? {}) as Record<string, unknown>;
      beforeSnapshot = currentData;
      const submittedData = (envelope.data ?? {}) as Record<string, unknown>;
      const finalData = input.merge
        ? { ...currentData, ...submittedData }
        : submittedData;
      changeSet = {
        before: currentData,
        submitted: submittedData,
        after: finalData,
        changedPaths: collectChangedPaths(currentData, finalData)
      };
      validateFinalData(finalData);

      const wholeDecision = PolicyEngine.evaluate(
        {
          documents: docs,
          action: "update",
          currentValue: currentData,
          dataValue: finalData
        },
        actor
      );

      const changedKeys = new Set<string>([...Object.keys(currentData), ...Object.keys(finalData)]);

      for (const k of changedKeys) {
        const before = currentData[k];
        const after = finalData[k];
        if (JSON.stringify(before) === JSON.stringify(after)) continue;
        const fieldPath = `data.${k}`;
        const action = input.policyActions?.[fieldPath] ??
          (after === undefined ? "delete" : before === undefined ? "create" : "update");
        const fieldDecision = PolicyEngine.evaluate(
          {
            documents: docs,
            action,
            fieldPath,
            dataValue: after,
            currentValue: before
          },
          actor
        );
        if (!wholeDecision.allow && !fieldDecision.allow) {
          throw new ApiError("POLICY_FORBIDDEN", {
            details: { fieldPath, decision: fieldDecision }
          });
        }
      }

      envelope.data = finalData;
      const rules = await MutationRuleService.loadActiveRules(input.appId, input.dataType, input.recordId);
      if (rules.length > 0) {
        const mutation = MutationRuleEngine.apply(rules, buildCommandContext(input, ctx, changeSet));
        if (mutation.appliedRules.length > 0) {
          envelope.data = mutation.data;
          changeSet = {
            before: currentData,
            submitted: submittedData,
            after: mutation.data,
            changedPaths: collectChangedPaths(currentData, mutation.data)
          };
          validateFinalData(mutation.data);
        }
      }

      const workflows = await WorkflowService.loadActiveWorkflows(input.appId, input.dataType, input.recordId);
      if (workflows.length > 0) {
        const workflow = WorkflowEngine.evaluate(workflows, buildCommandContext(input, { ...ctx, actor }, changeSet));
        if (!workflow.allow) throw new ApiError("BUSINESS_WORKFLOW_FORBIDDEN", { details: workflow });
      }
    }

    // 7) persist
    let record: RecordSnapshot;
    if (input.op === "create") {
      record = await RecordRepository.create({
        appId: input.appId,
        dataType: input.dataType,
        ownerId: input.ownerId ?? ctx.actor.userId,
        data: envelope.data,
        schemaVersionId: schemaSnap.id,
        actorUserId: ctx.actor.userId
      });
    } else {
      record = await RecordRepository.update({
        id: input.recordId!,
        data: envelope.data,
        schemaVersionId: schemaSnap.id,
        actorUserId: ctx.actor.userId
      });
    }

    // 8) event
    const at = Math.floor(Date.now() / 1000);
    if (input.op === "create") {
      await bus.publish("record.created", {
        appId: record.appId,
        dataType: record.dataType,
        recordId: record.id,
        ownerId: record.ownerId,
        data: record.data,
        actorId: ctx.actor.userId,
        at
      });
    } else {
      await bus.publish("record.updated", {
        appId: record.appId,
        dataType: record.dataType,
        recordId: record.id,
        ownerId: record.ownerId,
        before: beforeSnapshot,
        after: record.data,
        actorId: ctx.actor.userId,
        at
      });
    }

    return { record, command: buildCommandContext(input, ctx, changeSet) };
  }

  /** 软删除（仅校验 delete 权限）。 */
  static async deleteRecord(input: { appId: string; dataType: string; recordId: string }, ctx: DataPipelineRunCtx) {
    const existing = await RecordRepository.findById(input.recordId);
    if (!existing || existing.appId !== input.appId || existing.dataType !== input.dataType) {
      throw new ApiError("DATA_RECORD_NOT_FOUND");
    }
    const docs = await loadPolicyDocuments(input.appId, input.dataType, input.recordId);
    const decision = PolicyEngine.evaluate(
      { documents: docs, action: "delete" },
      { ...ctx.actor, ownerId: existing.ownerId }
    );
    if (!decision.allow) throw new ApiError("POLICY_FORBIDDEN", { details: decision });

    const changeSet: DataChangeSet = {
      before: asObject(existing.data),
      submitted: {},
      after: null,
      changedPaths: collectChangedPaths(existing.data, null)
    };
    const command: CommandContext = {
      actor: {
        ...ctx.actor,
        requestId: ctx.requestId,
        ip: ctx.ip ?? null
      },
      intent: {
        kind: "delete",
        appId: input.appId,
        dataType: input.dataType,
        recordId: input.recordId
      },
      changeSet
    };
    await RecordRepository.softDelete(input.recordId);
    await bus.publish("record.deleted", {
      appId: existing.appId,
      dataType: existing.dataType,
      recordId: existing.id,
      ownerId: existing.ownerId,
      actorId: ctx.actor.userId,
      at: Math.floor(Date.now() / 1000)
    });
    return { id: existing.id, command };
  }
}
