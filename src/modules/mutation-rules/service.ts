import { z } from "zod";
import { ApiError } from "@/shared/errors";
import { prisma } from "@/shared/prisma";
import {
  MutationRuleEngine,
  type BusinessCondition,
  type BusinessConditionValue,
  type CommandContext,
  type MutationRuleDocument,
  type MutationRuleOperation
} from "@/shared/business";

export const mutationRuleScopeSchema = z.enum(["app", "dataType", "record"]);
export type MutationRuleScope = z.infer<typeof mutationRuleScopeSchema>;

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

const mutationRuleOperationSchema: z.ZodType<MutationRuleOperation> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("set"), path: z.string().min(1).max(256), value: conditionValueSchema }),
  z.object({ type: z.literal("unset"), path: z.string().min(1).max(256) }),
  z.object({ type: z.literal("increment"), path: z.string().min(1).max(256), by: z.number() }),
  z.object({ type: z.literal("push"), path: z.string().min(1).max(256), value: conditionValueSchema, uniq: z.boolean().optional() })
]);

export const mutationRuleDocumentSchema: z.ZodType<MutationRuleDocument> = z.object({
  version: z.literal(1),
  id: z.string().min(1).max(128),
  dataType: z.string().min(1).max(64),
  description: z.string().max(500).optional(),
  on: z.array(z.string().min(1).max(256)).min(1),
  when: businessConditionSchema.nullish(),
  then: z.array(mutationRuleOperationSchema).min(1)
});

export const mutationRuleTargetSchema = z.string().min(1).max(128).optional().nullable();

export const mutationRuleUpsertInputSchema = z.object({
  scope: mutationRuleScopeSchema,
  target: mutationRuleTargetSchema,
  document: mutationRuleDocumentSchema,
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional()
});

export const mutationRulePreviewInputSchema = z.object({
  documents: z.array(mutationRuleDocumentSchema).optional(),
  command: z.custom<CommandContext>((value) => Boolean(value && typeof value === "object"))
});

export type MutationRuleUpsertInput = z.infer<typeof mutationRuleUpsertInputSchema>;
export type MutationRulePreviewInput = z.infer<typeof mutationRulePreviewInputSchema>;

type MutationRuleRow = Awaited<ReturnType<typeof prisma.mutationRuleDocument.findMany>>[number];

function now() {
  return Math.floor(Date.now() / 1000);
}

function ruleOrder(scope: string): number {
  return scope === "app" ? 0 : scope === "dataType" ? 1 : 2;
}

function normalizeTarget(scope: MutationRuleScope, target?: string | null): string | null {
  if (scope === "app") return null;
  const value = target?.trim();
  if (!value) throw new ApiError("BUSINESS_INVALID_RULE", { message: "dataType/record scope 必须提供 target" });
  return value;
}

function parseDocument(value: string | MutationRuleDocument): MutationRuleDocument {
  try {
    return mutationRuleDocumentSchema.parse(typeof value === "string" ? JSON.parse(value) : value);
  } catch (error) {
    throw new ApiError("BUSINESS_INVALID_RULE", {
      message: "MutationRuleDocument 不合法",
      details: error
    });
  }
}

function serializeDocument(document: MutationRuleDocument): string {
  return JSON.stringify(parseDocument(document));
}

function scopeTargetWhere(appId: string, scope: MutationRuleScope, target: string | null, ruleId: string) {
  return scope === "app"
    ? { appId, scope, target: null, ruleId }
    : { appId, scope, target: target ?? "", ruleId };
}

function rowToOutput(row: MutationRuleRow) {
  const document = parseDocument(row.document);
  return {
    id: row.id,
    appId: row.appId,
    scope: row.scope,
    target: row.target,
    ruleId: row.ruleId,
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

export class MutationRuleService {
  static async list(appId: string) {
    const rows = await prisma.mutationRuleDocument.findMany({
      where: { appId },
      orderBy: [{ scope: "asc" }, { target: "asc" }, { ruleId: "asc" }]
    });

    return rows
      .sort((a, b) => ruleOrder(a.scope) - ruleOrder(b.scope) || (a.target ?? "").localeCompare(b.target ?? ""))
      .map(rowToOutput);
  }

  static async upsert(appId: string, input: MutationRuleUpsertInput, actorUserId: string) {
    const target = normalizeTarget(input.scope, input.target);
    const document = parseDocument(input.document);
    const serialized = serializeDocument(document);
    const existing = await prisma.mutationRuleDocument.findFirst({
      where: scopeTargetWhere(appId, input.scope, target, document.id)
    });
    const t = now();

    const row = existing
      ? await prisma.mutationRuleDocument.update({
          where: { id: existing.id },
          data: {
            document: serialized,
            description: input.description ?? document.description ?? null,
            isActive: input.isActive === false ? 0 : 1,
            updatedAt: t,
            createdById: actorUserId
          }
        })
      : await prisma.mutationRuleDocument.create({
          data: {
            appId,
            scope: input.scope,
            target,
            ruleId: document.id,
            document: serialized,
            description: input.description ?? document.description ?? null,
            isActive: input.isActive === false ? 0 : 1,
            createdAt: t,
            updatedAt: t,
            createdById: actorUserId
          }
        });

    return { rule: rowToOutput(row) };
  }

  static async loadActiveRules(appId: string, dataType: string, recordId?: string): Promise<MutationRuleDocument[]> {
    const rows = await prisma.mutationRuleDocument.findMany({
      where: {
        appId,
        isActive: 1,
        OR: scopeChain(dataType, recordId)
      }
    });

    return rows
      .sort((a, b) => ruleOrder(a.scope) - ruleOrder(b.scope) || a.ruleId.localeCompare(b.ruleId))
      .map((row) => parseDocument(row.document))
      .filter((rule) => rule.dataType === dataType || rule.dataType === "*");
  }

  static async preview(appId: string, input: MutationRulePreviewInput) {
    const rules = input.documents ?? (await this.loadActiveRules(appId, input.command.intent.dataType, input.command.intent.recordId));
    return MutationRuleEngine.apply(rules, input.command);
  }

  static async explain(appId: string, input: MutationRulePreviewInput) {
    const rules = input.documents ?? (await this.loadActiveRules(appId, input.command.intent.dataType, input.command.intent.recordId));
    return MutationRuleEngine.explain(rules, input.command);
  }
}