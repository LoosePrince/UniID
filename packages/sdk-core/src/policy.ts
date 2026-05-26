/**
 * PolicyNamespace — 客户端权限文档构造辅助。
 *
 * 这些方法只生成 PolicyDocument JSON，不发起请求。SDK 用户可以将构造结果
 * 作为 record 的 `__permissions` 字段下发；服务器端使用 PolicyEngine 加以
 * 强制（永远以服务端为准）。
 */

export type PolicyVariable =
  | "$public"
  | "$all"
  | "$anyone"
  | "$owner"
  | "$app_admin"
  | "$system_admin"
  | `$user:${string}`
  | `$role:${string}`
  | `$function:${string}`
  | `$dynamic:${string}`;

export type PolicyAction =
  | "read"
  | "write"
  | "create"
  | "update"
  | "increment"
  | "push"
  | "set"
  | "unset"
  | "delete";

export type PolicyConditionValue =
  | string
  | number
  | boolean
  | null
  | PolicyConditionValue[]
  | { [key: string]: PolicyConditionValue };

export type PolicyCondition = Record<string, PolicyConditionValue>;

export interface PolicyRule {
  id: string;
  name?: string;
  description?: string;
  effect: "allow";
  actions: PolicyAction[];
  subjects: string[];
  resource?: { fields?: string[] };
  using?: PolicyCondition | null;
  check?: PolicyCondition | null;
}

export interface PolicyDocumentV2Object {
  version: 2;
  rules: PolicyRule[];
}

export interface PolicyFieldRule {
  read?: PolicyVariable[];
  write?: PolicyVariable[];
  create?: PolicyVariable[];
  update?: PolicyVariable[];
  delete?: PolicyVariable[];
  increment?: PolicyVariable[];
  push?: PolicyVariable[];
  set?: PolicyVariable[];
  unset?: PolicyVariable[];
}

export interface LegacyPolicyDocumentObject {
  default?: PolicyFieldRule;
  fields?: Record<string, PolicyFieldRule>;
}

export type PolicyDocumentObject = PolicyDocumentV2Object | LegacyPolicyDocumentObject;

export interface RuleInput {
  id: string;
  actions: PolicyAction | PolicyAction[];
  subjects: string | string[];
  fields?: string | string[];
  using?: PolicyCondition | null;
  check?: PolicyCondition | null;
  name?: string;
  description?: string;
}

const WRITE_ACTIONS: PolicyAction[] = ["create", "update", "delete", "set", "unset", "push", "increment"];

function list<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

function fieldsResource(fields?: string | string[]): { fields: string[] } | undefined {
  if (!fields) return undefined;
  return { fields: list(fields) };
}

function rule(input: RuleInput): PolicyRule {
  return {
    id: input.id,
    name: input.name,
    description: input.description,
    effect: "allow",
    actions: list(input.actions),
    subjects: list(input.subjects),
    resource: fieldsResource(input.fields),
    using: input.using ?? null,
    check: input.check ?? null
  };
}

function document(rules: PolicyRule[]): PolicyDocumentV2Object {
  return { version: 2, rules };
}

function legacyBlockToRules(block: PolicyFieldRule | undefined, prefix: string, fields?: string[]): PolicyRule[] {
  if (!block) return [];
  const actions: PolicyAction[] = ["read", "write", ...WRITE_ACTIONS];
  return actions.flatMap((action) => {
    const subjects = block[action];
    if (!subjects || subjects.length === 0) return [];
    return [rule({ id: `${prefix}-${action}`, actions: action, subjects, fields })];
  });
}

export const policy = {
  rule,

  document,

  publicRead(fields?: string | string[]): PolicyDocumentV2Object {
    return document([rule({ id: fields ? "public-read-fields" : "public-read", actions: "read", subjects: "$public", fields })]);
  },

  ownerOnly(): PolicyDocumentV2Object {
    return document([
      rule({ id: "owner-read", actions: "read", subjects: "$owner" }),
      rule({ id: "owner-write", actions: WRITE_ACTIONS, subjects: "$owner" })
    ]);
  },

  ownerWritePublicRead(): PolicyDocumentV2Object {
    return document([
      rule({ id: "public-read", actions: "read", subjects: "$public" }),
      rule({ id: "owner-write", actions: WRITE_ACTIONS, subjects: "$owner" })
    ]);
  },

  adminManage(): PolicyDocumentV2Object {
    return document([rule({ id: "app-admin-manage", actions: ["read", ...WRITE_ACTIONS], subjects: "$app_admin" })]);
  },

  field(fields: string | string[], actions: PolicyAction | PolicyAction[], subjects: string | string[], id = "field-rule"): PolicyRule {
    return rule({ id, actions, subjects, fields });
  },

  dynamicOwnerKey(input: {
    field: string;
    path: string;
    actions?: PolicyAction[];
    id?: string;
  }): PolicyRule {
    return rule({
      id: input.id ?? "dynamic-owner-key",
      actions: input.actions ?? ["set", "unset", "push"],
      subjects: `$dynamic:${input.path}`,
      fields: input.field
    });
  },

  fromV1(doc: LegacyPolicyDocumentObject): PolicyDocumentV2Object {
    return document([
      ...Object.entries(doc.fields ?? {}).flatMap(([field, block]) =>
        legacyBlockToRules(block, `legacy-field-${field.replace(/[^A-Za-z0-9_-]+/g, "-")}`, [field])
      ),
      ...legacyBlockToRules(doc.default, "legacy-default")
    ]);
  },

  /** @deprecated 使用 publicRead / ownerWritePublicRead / fromV1。 */
  public(): PolicyDocumentV2Object {
    return this.ownerWritePublicRead();
  },

  /** @deprecated 使用 ownerOnly。 */
  private(): PolicyDocumentV2Object {
    return this.ownerOnly();
  },

  /** @deprecated 使用 publicRead + adminManage 组合。 */
  readOnly(): PolicyDocumentV2Object {
    return document([
      rule({ id: "public-read", actions: "read", subjects: "$public" }),
      rule({ id: "app-admin-write", actions: WRITE_ACTIONS, subjects: "$app_admin" })
    ]);
  },

  /** @deprecated 旧版字段 DSL；需要 v2 时使用 fromV1。 */
  withFields(fields: Record<string, PolicyFieldRule>, base?: LegacyPolicyDocumentObject): LegacyPolicyDocumentObject {
    return {
      default: base?.default ?? { read: ["$public"], write: ["$owner", "$app_admin"] },
      fields: { ...(base?.fields ?? {}), ...fields }
    };
  }
};
