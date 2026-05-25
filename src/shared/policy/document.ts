/**
 * Policy DSL — 文档结构与解析。
 *
 *   {
 *     "default": { "read": ["$public"], "create": ["$owner"], ... },
 *     "fields":  { "data.title": { "read": [...] }, "data.likes.*.time": {...} }
 *   }
 *
 * - "default" 覆盖整条记录；"fields" 对具体字段路径覆盖
 * - 多个 PolicyDocument 可被合并（app default → dataType default → record override）
 * - 操作类型见 `PolicyAction`
 */

import { z } from "zod";

export const POLICY_ACTIONS = [
  "read",
  "write",     // 兼容旧版：write = create ∪ update ∪ increment ∪ push
  "create",
  "update",
  "increment",
  "push",
  "delete"
] as const;
export type PolicyAction = (typeof POLICY_ACTIONS)[number];

const permListSchema = z.array(z.string()).default([]);

const defaultBlockSchema = z
  .object({
    read: permListSchema.optional(),
    write: permListSchema.optional(),
    create: permListSchema.optional(),
    update: permListSchema.optional(),
    increment: permListSchema.optional(),
    push: permListSchema.optional(),
    delete: permListSchema.optional()
  })
  .strict();

const fieldBlockSchema = defaultBlockSchema; // 同结构

export const policyDocumentSchema = z
  .object({
    default: defaultBlockSchema.optional(),
    fields: z.record(z.string(), fieldBlockSchema).optional()
  })
  .strict();

export type PolicyDocument = z.infer<typeof policyDocumentSchema>;
export type PolicyBlock = z.infer<typeof defaultBlockSchema>;

export function parsePolicyDocument(input: unknown): PolicyDocument {
  if (typeof input === "string") {
    try {
      input = JSON.parse(input);
    } catch {
      return {};
    }
  }
  if (input == null || typeof input !== "object") return {};
  const parsed = policyDocumentSchema.safeParse(input);
  return parsed.success ? parsed.data : {};
}

/** 合并优先级：覆盖者 > 被覆盖者（字段路径 deep merge）。 */
export function mergePolicy(...docs: PolicyDocument[]): PolicyDocument {
  const out: PolicyDocument = {};
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
