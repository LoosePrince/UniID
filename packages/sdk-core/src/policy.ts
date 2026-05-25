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
  | "$owner"
  | "$app_admin"
  | "$system_admin"
  | `$user:${string}`
  | `$role:${string}`
  | `$function:${string}`
  | `$dynamic:${string}`;

export interface PolicyFieldRule {
  read?: PolicyVariable[];
  write?: PolicyVariable[];
  create?: PolicyVariable[];
  update?: PolicyVariable[];
  delete?: PolicyVariable[];
  increment?: PolicyVariable[];
  push?: PolicyVariable[];
}

export interface PolicyDocumentObject {
  default?: PolicyFieldRule;
  fields?: Record<string, PolicyFieldRule>;
}

export const policy = {
  public(): PolicyDocumentObject {
    return { default: { read: ["$public"], write: ["$owner", "$app_admin"] } };
  },
  private(): PolicyDocumentObject {
    return { default: { read: ["$owner", "$app_admin"], write: ["$owner", "$app_admin"] } };
  },
  readOnly(): PolicyDocumentObject {
    return { default: { read: ["$public"], write: ["$app_admin"] } };
  },
  withFields(fields: Record<string, PolicyFieldRule>, base?: PolicyDocumentObject): PolicyDocumentObject {
    return {
      default: base?.default ?? { read: ["$public"], write: ["$owner", "$app_admin"] },
      fields: { ...(base?.fields ?? {}), ...fields }
    };
  }
};
