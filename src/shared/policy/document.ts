/**
 * Policy DSL — 文档结构、解析与 v1/v2 归一化。
 *
 * v1：
 *   {
 *     "default": { "read": ["$public"], "create": ["$owner"] },
 *     "fields":  { "data.title": { "read": ["$public"] } }
 *   }
 *
 * v2：
 *   {
 *     "version": 2,
 *     "rules": [
 *       {
 *         "id": "public-read-title",
 *         "effect": "allow",
 *         "actions": ["read"],
 *         "subjects": ["$public"],
 *         "resource": { "fields": ["data.title"] },
 *         "using": null,
 *         "check": null
 *       }
 *     ]
 *   }
 */

import { z } from "zod";

export const POLICY_ACTIONS = [
  "read",
  "write", // 兼容旧版：write = create ∪ update ∪ increment ∪ push ∪ set ∪ unset
  "create",
  "update",
  "increment",
  "push",
  "set",
  "unset",
  "delete"
] as const;
export type PolicyAction = (typeof POLICY_ACTIONS)[number];

export const POLICY_EFFECTS = ["allow"] as const;
export type PolicyEffect = (typeof POLICY_EFFECTS)[number];

const permListSchema = z.array(z.string()).default([]);

const legacyBlockSchema = z
  .object({
    read: permListSchema.optional(),
    write: permListSchema.optional(),
    create: permListSchema.optional(),
    update: permListSchema.optional(),
    increment: permListSchema.optional(),
    push: permListSchema.optional(),
    set: permListSchema.optional(),
    unset: permListSchema.optional(),
    delete: permListSchema.optional()
  })
  .strict();

export const legacyPolicyDocumentSchema = z
  .object({
    default: legacyBlockSchema.optional(),
    fields: z.record(z.string(), legacyBlockSchema).optional()
  })
  .strict();

const conditionValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(conditionValueSchema),
    z.record(z.string(), conditionValueSchema)
  ])
);

export const policyConditionSchema = z.record(z.string(), conditionValueSchema);

export const policyRuleSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().optional(),
    description: z.string().optional(),
    effect: z.enum(POLICY_EFFECTS).default("allow"),
    actions: z.array(z.enum(POLICY_ACTIONS)).min(1),
    subjects: z.array(z.string()).min(1),
    resource: z
      .object({
        fields: z.array(z.string()).optional()
      })
      .strict()
      .optional(),
    using: policyConditionSchema.nullable().optional(),
    check: policyConditionSchema.nullable().optional()
  })
  .strict();

export const policyDocumentV2Schema = z
  .object({
    version: z.literal(2),
    rules: z.array(policyRuleSchema).default([])
  })
  .strict();

export type LegacyPolicyDocument = z.infer<typeof legacyPolicyDocumentSchema>;
export type PolicyBlock = z.infer<typeof legacyBlockSchema>;
export type PolicyCondition = z.infer<typeof policyConditionSchema>;
export type PolicyRule = z.infer<typeof policyRuleSchema>;
export type PolicyDocumentV2 = z.infer<typeof policyDocumentV2Schema>;
export type PolicyDocument = LegacyPolicyDocument | PolicyDocumentV2;

function safeObject(input: unknown): unknown {
  if (typeof input !== "string") return input;
  try {
    return JSON.parse(input);
  } catch {
    return {};
  }
}

function parseV2(input: unknown): PolicyDocumentV2 | null {
  const parsed = policyDocumentV2Schema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

function parseLegacy(input: unknown): LegacyPolicyDocument | null {
  const parsed = legacyPolicyDocumentSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

export function parsePolicyDocument(input: unknown): PolicyDocument {
  const value = safeObject(input);
  if (value == null || typeof value !== "object") return {};
  const v2 = parseV2(value);
  if (v2) return v2;
  const legacy = parseLegacy(value);
  return legacy ?? {};
}

function pathId(path: string): string {
  return path.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "field";
}

function effectiveLegacyActions(block: PolicyBlock): Array<PolicyAction> {
  return POLICY_ACTIONS.filter((action) => {
    const list = block[action];
    return Array.isArray(list) && list.length > 0;
  });
}

function legacyBlockToRules(
  block: PolicyBlock | undefined,
  rulePrefix: string,
  fields?: string[]
): PolicyRule[] {
  if (!block) return [];
  return effectiveLegacyActions(block).map((action) => ({
    id: `${rulePrefix}-${action}`,
    effect: "allow",
    actions: [action],
    subjects: block[action] ?? [],
    resource: fields ? { fields } : undefined,
    using: null,
    check: null
  }));
}

/** 合并优先级：覆盖者 > 被覆盖者（字段路径 deep merge）。 */
export function mergeLegacyPolicy(...docs: LegacyPolicyDocument[]): LegacyPolicyDocument {
  const out: LegacyPolicyDocument = {};
  for (const doc of docs) {
    if (doc.default) {
      out.default = { ...(out.default ?? {}), ...doc.default };
    }
    if (doc.fields) {
      out.fields = { ...(out.fields ?? {}) };
      for (const [path, block] of Object.entries(doc.fields)) {
        out.fields[path] = { ...(out.fields[path] ?? {}), ...block };
      }
    }
  }
  return out;
}

export function legacyToV2(doc: LegacyPolicyDocument, prefix = "legacy"): PolicyDocumentV2 {
  const rules: PolicyRule[] = [];

  for (const [path, block] of Object.entries(doc.fields ?? {})) {
    rules.push(...legacyBlockToRules(block, `${prefix}-field-${pathId(path)}`, [path]));
  }

  rules.push(...legacyBlockToRules(doc.default, `${prefix}-default`));

  return { version: 2, rules };
}

export function normalizePolicyDocument(input: unknown): PolicyDocumentV2 {
  const parsed = parsePolicyDocument(input);
  if ("version" in parsed && parsed.version === 2) return parsed;
  return legacyToV2(parsed as LegacyPolicyDocument);
}

export function normalizePolicyDocuments(
  docs: Array<PolicyDocument | string | null | undefined>
): { document: PolicyDocumentV2; legacyOnly: boolean } {
  const parsed = docs.map((doc) => (doc == null ? {} : parsePolicyDocument(doc)));
  const legacyOnly = parsed.every((doc) => !("version" in doc));

  if (legacyOnly) {
    const merged = mergeLegacyPolicy(...(parsed as LegacyPolicyDocument[]));
    return { document: legacyToV2(merged), legacyOnly: true };
  }

  const rules = parsed.flatMap((doc, index) => {
    if ("version" in doc && doc.version === 2) return doc.rules;
    return legacyToV2(doc as LegacyPolicyDocument, `legacy-${index}`).rules;
  });

  return { document: { version: 2, rules }, legacyOnly: false };
}

/** @deprecated 使用 mergeLegacyPolicy 或 normalizePolicyDocuments。 */
export const mergePolicy = mergeLegacyPolicy;