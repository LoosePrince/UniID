/**
 * DataPipeline — 写入数据的统一流水线。
 *
 *   1. 解析 policy 文档（app + dataType + record-override 顺序）
 *   2. 加载 active schema（如不存在且策略未启用 schemaless，拒绝）
 *   3. autofill（$serverTime/$userId/...，仅 create 强制覆盖）
 *   4. AJV JSON Schema 校验（fail 则 VALIDATION_FAILED）
 *   5. 自定义 validationRules（QuickJS 沙箱执行）—— M6 接入；当前为 no-op
 *   6. PolicyEngine 字段级校验：对所有发生变化的顶层字段判定
 *   7. RecordRepository 持久化
 *   8. bus.emit record.created / updated
 */

import type { AuthContext } from "@/shared/policy/variables";
import { PolicyEngine, type PolicyAction } from "@/shared/policy";
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
}

export interface DataPipelineRunCtx {
  actor: AuthContext;
  requestId?: string;
  ip?: string | null;
}

export interface DataPipelineResult {
  record: RecordSnapshot;
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
    if (!validate(envelope.data)) {
      throw new ApiError("VALIDATION_FAILED", {
        details: { errors: formatAjvErrors(validate.errors) }
      });
    }

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
    let beforeSnapshot: unknown = null;
    if (input.op === "create") {
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
      bus.emit("record.created", {
        appId: record.appId,
        dataType: record.dataType,
        recordId: record.id,
        ownerId: record.ownerId,
        data: record.data,
        actorId: ctx.actor.userId,
        at
      });
    } else {
      bus.emit("record.updated", {
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

    return { record };
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

    await RecordRepository.softDelete(input.recordId);
    bus.emit("record.deleted", {
      appId: existing.appId,
      dataType: existing.dataType,
      recordId: existing.id,
      ownerId: existing.ownerId,
      actorId: ctx.actor.userId,
      at: Math.floor(Date.now() / 1000)
    });
    return { id: existing.id };
  }
}
