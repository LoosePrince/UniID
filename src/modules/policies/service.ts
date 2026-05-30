import { z } from "zod";
import { ApiError } from "@/shared/errors";
import type { SupportedLocale } from "@/shared/i18n/config";
import { translate } from "@/shared/i18n/core";
import { prisma } from "@/shared/prisma";
import {
  normalizePolicyDocument,
  parsePolicyDocument,
  policyDocumentV2Schema,
  legacyPolicyDocumentSchema,
  PolicyEngine,
  type AuthContext,
  type LegacyPolicyDocument,
  type PolicyAction,
  type PolicyDocument
} from "@/shared/policy";

export const policyScopeSchema = z.enum(["app", "dataType", "record"]);
export type PolicyScope = z.infer<typeof policyScopeSchema>;

export const policyTargetSchema = z.string().min(1).max(128).optional().nullable();

export const policyDocumentInputSchema = z.union([policyDocumentV2Schema, legacyPolicyDocumentSchema]);

export const policyUpsertInputSchema = z.object({
  scope: policyScopeSchema,
  target: policyTargetSchema,
  document: policyDocumentInputSchema,
  description: z.string().max(500).optional().nullable()
});

export const policyExplainInputSchema = z.object({
  scope: policyScopeSchema.default("app"),
  target: policyTargetSchema,
  dataType: z.string().min(1).max(64).optional().nullable(),
  action: z.enum(["read", "write", "create", "update", "increment", "push", "set", "unset", "delete"]),
  fieldPath: z.string().min(1).max(256).optional(),
  actor: z
    .object({
      userId: z.string().nullable().optional(),
      role: z.string().nullable().optional(),
      systemAdmin: z.boolean().optional(),
      appAdmin: z.boolean().optional(),
      authType: z.enum(["full", "restricted"]).optional(),
      ownerId: z.string().nullable().optional(),
      origin: z.enum(["sdk", "function", "system"]).nullable().optional(),
      functionName: z.string().nullable().optional()
    })
    .optional(),
  currentValue: z.unknown().optional(),
  dataValue: z.unknown().optional(),
  documents: z.array(policyDocumentInputSchema).optional()
});

export const policyPreviewMigrationInputSchema = z.object({
  scope: policyScopeSchema.optional(),
  target: policyTargetSchema,
  document: z.unknown().optional()
});

type PolicyUpsertInput = z.infer<typeof policyUpsertInputSchema>;
type PolicyExplainInput = z.infer<typeof policyExplainInputSchema>;
type PolicyPreviewMigrationInput = z.infer<typeof policyPreviewMigrationInputSchema>;

function now() {
  return Math.floor(Date.now() / 1000);
}

function normalizeTarget(scope: PolicyScope, target?: string | null): string | null {
  if (scope === "app") return null;
  const value = target?.trim();
  if (!value) throw new ApiError("POLICY_INVALID_DOCUMENT", { message: "error.detail.scopeTargetRequired" });
  return value;
}

function safeParseDocument(document: string): PolicyDocument {
  try {
    return parsePolicyDocument(JSON.parse(document));
  } catch {
    return parsePolicyDocument(document);
  }
}

function serializeDocument(document: unknown): string {
  const parsed = parsePolicyDocument(document);
  const normalized = normalizePolicyDocument(parsed);
  return JSON.stringify(normalized);
}

function policyOrder(scope: string): number {
  return scope === "app" ? 0 : scope === "dataType" ? 1 : 2;
}

function scopeChain(scope: PolicyScope, target: string | null, dataType?: string | null) {
  if (scope === "app") return [{ scope: "app", target: null }];
  if (scope === "dataType") {
    return [
      { scope: "app", target: null },
      { scope: "dataType", target }
    ];
  }
  return [
    { scope: "app", target: null },
    ...(dataType ? [{ scope: "dataType", target: dataType }] : []),
    { scope: "record", target }
  ];
}

function buildActor(appId: string, actor: PolicyExplainInput["actor"]): AuthContext {
  return {
    userId: actor?.userId ?? null,
    role: actor?.role ?? null,
    systemAdmin: actor?.systemAdmin ?? false,
    appAdmin: actor?.appAdmin ?? false,
    appId,
    authType: actor?.authType ?? "restricted",
    ownerId: actor?.ownerId ?? null,
    origin: actor?.origin ?? "system",
    functionName: actor?.functionName ?? undefined
  };
}

function migrationWarnings(document: PolicyDocument, locale: SupportedLocale) {
  const warnings: string[] = [];
  if ("version" in document && document.version === 2) {
    warnings.push(translate(locale, "policy.migration.alreadyV2"));
    return warnings;
  }

  const legacy = document as LegacyPolicyDocument;
  if (legacy.default?.write && legacy.default.write.length > 0) {
    warnings.push(translate(locale, "policy.migration.defaultWriteKept"));
  }
  for (const [field, block] of Object.entries(legacy.fields ?? {})) {
    if (block.write && block.write.length > 0) {
      warnings.push(translate(locale, "policy.migration.fieldWriteKept", { field }));
    }
  }
  return warnings;
}

function scopeTargetWhere(appId: string, scope: PolicyScope, target: string | null) {
  return scope === "app" ? { appId, scope, target: null } : { appId, scope, target: target ?? "" };
}

async function upsertPolicyDocument(input: {
  appId: string;
  scope: PolicyScope;
  target: string | null;
  document: string;
  description?: string | null;
  actorUserId: string;
}) {
  const existing = await prisma.policyDocument.findFirst({
    where: scopeTargetWhere(input.appId, input.scope, input.target)
  });
  const t = now();

  if (existing) {
    return prisma.policyDocument.update({
      where: { id: existing.id },
      data: {
        document: input.document,
        description: input.description ?? null,
        updatedAt: t,
        createdById: input.actorUserId
      }
    });
  }

  return prisma.policyDocument.create({
    data: {
      appId: input.appId,
      scope: input.scope,
      target: input.target,
      document: input.document,
      description: input.description ?? null,
      createdAt: t,
      updatedAt: t,
      createdById: input.actorUserId
    }
  });
}

export class PolicyAdminService {
  static async list(appId: string) {
    const policies = await prisma.policyDocument.findMany({
      where: { appId },
      orderBy: [{ scope: "asc" }, { target: "asc" }]
    });

    return policies
      .sort((a, b) => policyOrder(a.scope) - policyOrder(b.scope) || (a.target ?? "").localeCompare(b.target ?? ""))
      .map((policy) => {
        const document = safeParseDocument(policy.document);
        return {
          id: policy.id,
          appId: policy.appId,
          scope: policy.scope,
          target: policy.target,
          description: policy.description,
          document,
          normalized: normalizePolicyDocument(document),
          createdAt: policy.createdAt,
          updatedAt: policy.updatedAt,
          createdById: policy.createdById
        };
      });
  }

  static async upsert(appId: string, input: PolicyUpsertInput, actorUserId: string) {
    const target = normalizeTarget(input.scope, input.target);
    const document = serializeDocument(input.document);

    const policy = await upsertPolicyDocument({
      appId,
      scope: input.scope,
      target,
      document,
      description: input.description,
      actorUserId
    });

    const parsed = safeParseDocument(policy.document);
    return {
      policy: {
        id: policy.id,
        appId: policy.appId,
        scope: policy.scope,
        target: policy.target,
        description: policy.description,
        document: parsed,
        normalized: normalizePolicyDocument(parsed),
        createdAt: policy.createdAt,
        updatedAt: policy.updatedAt,
        createdById: policy.createdById
      }
    };
  }

  static async explain(appId: string, input: PolicyExplainInput) {
    const target = normalizeTarget(input.scope, input.target);
    const documents = input.documents ?? (await this.loadDocuments(appId, input.scope, target, input.dataType));
    const actor = buildActor(appId, input.actor);
    const explanation = PolicyEngine.explain(
      {
        documents,
        action: input.action as PolicyAction,
        fieldPath: input.fieldPath,
        currentValue: input.currentValue,
        dataValue: input.dataValue
      },
      actor
    );

    return {
      scope: input.scope,
      target,
      actor,
      input: {
        action: input.action,
        fieldPath: input.fieldPath,
        currentValue: input.currentValue,
        dataValue: input.dataValue
      },
      documents: documents.map((document) => normalizePolicyDocument(document)),
      ...explanation
    };
  }

  static async previewMigration(appId: string, input: PolicyPreviewMigrationInput, locale: SupportedLocale) {
    const source = input.document ?? (await this.loadSingleDocument(appId, input.scope ?? "app", normalizeTarget(input.scope ?? "app", input.target)));
    const parsed = parsePolicyDocument(source);
    return {
      source: parsed,
      normalized: normalizePolicyDocument(parsed),
      warnings: migrationWarnings(parsed, locale)
    };
  }

  private static async loadDocuments(
    appId: string,
    scope: PolicyScope,
    target: string | null,
    dataType?: string | null
  ) {
    const chain = scopeChain(scope, target, dataType);
    const policies = await prisma.policyDocument.findMany({
      where: { appId, OR: chain }
    });
    return policies
      .sort((a, b) => policyOrder(a.scope) - policyOrder(b.scope))
      .map((policy) => safeParseDocument(policy.document));
  }

  private static async loadSingleDocument(appId: string, scope: PolicyScope, target: string | null) {
    const policy = await prisma.policyDocument.findFirst({
      where: scopeTargetWhere(appId, scope, target)
    });
    if (!policy) throw new ApiError("POLICY_INVALID_DOCUMENT", { message: "error.detail.policyMigrationNotFound" });
    return safeParseDocument(policy.document);
  }
}