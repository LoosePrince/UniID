import { z } from "zod";
import { ApiError } from "@/shared/errors";
import { prisma } from "@/shared/prisma";
import {
  WorkflowEngine,
  type BusinessCondition,
  type BusinessConditionValue,
  type CommandContext,
  type WorkflowDocument
} from "@/shared/business";

export const workflowScopeSchema = z.enum(["app", "dataType", "record"]);
export type WorkflowScope = z.infer<typeof workflowScopeSchema>;

const conditionValueSchema: z.ZodType<BusinessConditionValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(conditionValueSchema),
    z.record(conditionValueSchema)
  ])
);

const businessConditionSchema: z.ZodType<BusinessCondition> = z.record(conditionValueSchema);

export const workflowDocumentSchema: z.ZodType<WorkflowDocument> = z.object({
  version: z.literal(1),
  id: z.string().min(1).max(128),
  dataType: z.string().min(1).max(64),
  stateField: z.string().min(1).max(256),
  transitions: z
    .array(
      z.object({
        id: z.string().min(1).max(128),
        from: z.union([z.string(), z.array(z.string()).min(1)]),
        to: z.string(),
        action: z.string().min(1).max(128),
        subjects: z.array(z.string()).optional(),
        using: businessConditionSchema.nullish(),
        check: businessConditionSchema.nullish()
      })
    )
    .min(1)
});

export const workflowTargetSchema = z.string().min(1).max(128).optional().nullable();

export const workflowUpsertInputSchema = z.object({
  scope: workflowScopeSchema,
  target: workflowTargetSchema,
  document: workflowDocumentSchema,
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional()
});

export const workflowPreviewInputSchema = z.object({
  documents: z.array(workflowDocumentSchema).optional(),
  command: z.custom<CommandContext>((value) => Boolean(value && typeof value === "object"))
});

export type WorkflowUpsertInput = z.infer<typeof workflowUpsertInputSchema>;
export type WorkflowPreviewInput = z.infer<typeof workflowPreviewInputSchema>;

type WorkflowRow = Awaited<ReturnType<typeof prisma.workflowDocument.findMany>>[number];

function now() {
  return Math.floor(Date.now() / 1000);
}

function workflowOrder(scope: string): number {
  return scope === "app" ? 0 : scope === "dataType" ? 1 : 2;
}

function normalizeTarget(scope: WorkflowScope, target?: string | null): string | null {
  if (scope === "app") return null;
  const value = target?.trim();
  if (!value) throw new ApiError("BUSINESS_INVALID_RULE", { message: "error.detail.scopeTargetRequired" });
  return value;
}

function parseDocument(value: string | WorkflowDocument): WorkflowDocument {
  try {
    return workflowDocumentSchema.parse(typeof value === "string" ? JSON.parse(value) : value);
  } catch (error) {
    throw new ApiError("BUSINESS_INVALID_RULE", {
      message: "error.detail.workflowDocumentInvalid",
      details: error
    });
  }
}

function serializeDocument(document: WorkflowDocument): string {
  return JSON.stringify(parseDocument(document));
}

function scopeTargetWhere(appId: string, scope: WorkflowScope, target: string | null, workflowId: string) {
  return scope === "app"
    ? { appId, scope, target: null, workflowId }
    : { appId, scope, target: target ?? "", workflowId };
}

function rowToOutput(row: WorkflowRow) {
  const document = parseDocument(row.document);
  return {
    id: row.id,
    appId: row.appId,
    scope: row.scope,
    target: row.target,
    workflowId: row.workflowId,
    description: row.description,
    isActive: row.isActive === 1,
    document,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdById: row.createdById
  };
}

function scopeChain(dataType: string, recordId?: string) {
  return [
    { scope: "app", target: null },
    { scope: "dataType", target: dataType },
    ...(recordId ? [{ scope: "record", target: recordId }] : [])
  ];
}

export class WorkflowService {
  static async list(appId: string) {
    const rows = await prisma.workflowDocument.findMany({
      where: { appId },
      orderBy: [{ scope: "asc" }, { target: "asc" }, { workflowId: "asc" }]
    });

    return rows
      .sort((a, b) => workflowOrder(a.scope) - workflowOrder(b.scope) || (a.target ?? "").localeCompare(b.target ?? ""))
      .map(rowToOutput);
  }

  static async upsert(appId: string, input: WorkflowUpsertInput, actorUserId: string) {
    const target = normalizeTarget(input.scope, input.target);
    const document = parseDocument(input.document);
    const serialized = serializeDocument(document);
    const existing = await prisma.workflowDocument.findFirst({
      where: scopeTargetWhere(appId, input.scope, target, document.id)
    });
    const t = now();

    const row = existing
      ? await prisma.workflowDocument.update({
          where: { id: existing.id },
          data: {
            document: serialized,
            description: input.description ?? null,
            isActive: input.isActive === false ? 0 : 1,
            updatedAt: t,
            createdById: actorUserId
          }
        })
      : await prisma.workflowDocument.create({
          data: {
            appId,
            scope: input.scope,
            target,
            workflowId: document.id,
            document: serialized,
            description: input.description ?? null,
            isActive: input.isActive === false ? 0 : 1,
            createdAt: t,
            updatedAt: t,
            createdById: actorUserId
          }
        });

    return { workflow: rowToOutput(row) };
  }

  static async loadActiveWorkflows(appId: string, dataType: string, recordId?: string): Promise<WorkflowDocument[]> {
    const rows = await prisma.workflowDocument.findMany({
      where: {
        appId,
        isActive: 1,
        OR: scopeChain(dataType, recordId)
      }
    });

    return rows
      .sort((a, b) => workflowOrder(a.scope) - workflowOrder(b.scope) || a.workflowId.localeCompare(b.workflowId))
      .map((row) => parseDocument(row.document))
      .filter((workflow) => workflow.dataType === dataType || workflow.dataType === "*");
  }

  static async preview(appId: string, input: WorkflowPreviewInput) {
    const workflows = input.documents ?? (await this.loadActiveWorkflows(appId, input.command.intent.dataType, input.command.intent.recordId));
    return WorkflowEngine.evaluate(workflows, input.command);
  }

  static async explain(appId: string, input: WorkflowPreviewInput) {
    return this.preview(appId, input);
  }
}