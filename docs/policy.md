# 权限策略（PolicyDocument v2）

UniID 的权限是应用层 PolicyDocument，不是数据库 RLS。运行时按以下顺序组合：

```text
app default → dataType default → record override
```

没有明确允许就拒绝。Schema 负责数据结构和校验；PolicyDocument 只负责访问规则。

## v2 文档结构

```json
{
  "version": 2,
  "rules": [
    {
      "id": "public-read-title",
      "effect": "allow",
      "actions": ["read"],
      "subjects": ["$public"],
      "resource": { "fields": ["data.title", "data.summary"] },
      "using": null,
      "check": null
    },
    {
      "id": "owner-update",
      "effect": "allow",
      "actions": ["update", "set", "unset"],
      "subjects": ["$owner"],
      "resource": { "fields": ["data.*"] },
      "using": { "ownerId": "$userId" },
      "check": { "data.ownerId": "$userId" }
    }
  ]
}
```

规则含义：

| 字段 | 含义 |
|------|------|
| `id` | 规则稳定标识，便于 explain 和控制台展示 |
| `effect` | 当前只支持 `allow` |
| `actions` | 允许的动作 |
| `subjects` | 可匹配的身份变量 |
| `resource.fields` | 可选字段范围，例如 `data.title`、`data.*` |
| `using` | 基于旧数据/当前资源的条件 |
| `check` | 基于新数据/写入结果的条件 |

## 动作

| 动作 | 场景 |
|------|------|
| `read` | 查询、详情、Realtime payload 过滤 |
| `create` | 新建记录 |
| `update` | 整体或合并更新 |
| `delete` | 删除记录 |
| `increment` | 数字增减 |
| `push` | 数组追加 |
| `set` | 设置字段 |
| `unset` | 删除字段 |
| `write` | 旧版兼容动作，新配置建议拆成具体动作 |

## Subject 变量

| 变量 | 含义 |
|------|------|
| `$public` | 任何人，包括未登录 |
| `$all` / `$anyone` | 任意已登录用户 |
| `$owner` | 资源 `ownerId === ctx.userId` |
| `$app_admin` | 当前 App 管理员 |
| `$system_admin` | UniID 系统管理员 |
| `$user:{id}` | 指定用户 |
| `$role:{role}` | 指定角色 |
| `$function:{name}` | 指定 Edge Function 调用身份 |
| `$dynamic:{path}` | 动态字段权限，例如点赞/投票 |

## using / check

`using` 看旧数据，适合读、改、删前置条件。

`check` 看新数据，适合创建或更新后的数据约束。

```json
{
  "id": "owner-create",
  "effect": "allow",
  "actions": ["create"],
  "subjects": ["$all"],
  "using": null,
  "check": { "data.ownerId": "$userId" }
}
```

常用占位值：

| 占位 | 来源 |
|------|------|
| `$userId` | 当前用户 ID |
| `$role` | 当前用户角色 |
| `$appId` | 当前 App ID |
| `$authType` | `full` 或 `restricted` |
| `$ownerId` | 当前资源 owner |

条件路径基于上下文对象，例如：

```json
{
  "ownerId": "$userId",
  "data.status": "published"
}
```

## 字段权限

字段范围写在 `resource.fields` 中：

```json
{
  "id": "public-read-title",
  "effect": "allow",
  "actions": ["read"],
  "subjects": ["$public"],
  "resource": { "fields": ["data.title", "data.summary"] },
  "using": null,
  "check": null
}
```

读取时，整条记录不允许但部分字段允许，服务端会返回过滤后的 `data`。Realtime 推送同样会过滤 payload，避免 SSE 泄露字段。

## 动态权限

动态权限适合“用户只能操作自己那一格”的数据结构。

```json
{
  "id": "self-like",
  "effect": "allow",
  "actions": ["set", "unset", "push"],
  "subjects": ["$dynamic:likes.$user"],
  "resource": { "fields": ["data.likes.*"] },
  "using": null,
  "check": null
}
```

含义：当前用户只能操作 `likes.<当前用户ID>` 对应的数据。

## 常见模板

### 公开只读

```json
{
  "version": 2,
  "rules": [
    {
      "id": "public-read",
      "effect": "allow",
      "actions": ["read"],
      "subjects": ["$public"],
      "using": null,
      "check": null
    }
  ]
}
```

### 用户私有

```json
{
  "version": 2,
  "rules": [
    { "id": "owner-read", "effect": "allow", "actions": ["read"], "subjects": ["$owner"], "using": null, "check": null },
    { "id": "owner-write", "effect": "allow", "actions": ["create", "update", "delete", "set", "unset", "push", "increment"], "subjects": ["$owner"], "using": null, "check": null }
  ]
}
```

### 公开读，作者写

```json
{
  "version": 2,
  "rules": [
    { "id": "public-read", "effect": "allow", "actions": ["read"], "subjects": ["$public"], "using": null, "check": null },
    { "id": "owner-write", "effect": "allow", "actions": ["create", "update", "delete", "set", "unset", "push", "increment"], "subjects": ["$owner"], "using": null, "check": null }
  ]
}
```

### 管理员管理

```json
{
  "version": 2,
  "rules": [
    {
      "id": "app-admin-manage",
      "effect": "allow",
      "actions": ["read", "create", "update", "delete", "set", "unset", "push", "increment"],
      "subjects": ["$app_admin"],
      "using": null,
      "check": null
    }
  ]
}
```

## SDK 构造器

SDK 只生成 JSON，不绕过服务端校验。

```ts
import { policy } from "@uniid/sdk";

const publicRead = policy.publicRead();
const ownerOnly = policy.ownerOnly();
const ownerWritePublicRead = policy.ownerWritePublicRead();

const titleOnly = policy.document([
  policy.field(["data.title", "data.summary"], "read", "$public", "public-read-title")
]);

const likes = policy.document([
  policy.rule({ id: "public-read", actions: "read", subjects: "$public" }),
  policy.dynamicOwnerKey({ field: "data.likes.*", path: "likes.$user" })
]);
```

更底层的规则构造：

```ts
policy.rule({
  id: "owner-update-title",
  actions: ["update", "set"],
  subjects: "$owner",
  fields: "data.title",
  using: { "ownerId": "$userId" },
  check: { "data.ownerId": "$userId" }
});
```

旧版文档迁移：

```ts
const v2 = policy.fromV1({
  default: { read: ["$public"], write: ["$owner"] },
  fields: { "data.title": { read: ["$public"] } }
});
```

## v1 兼容

旧版仍可读取：

```json
{
  "default": {
    "read": ["$public"],
    "write": ["$owner", "$app_admin"]
  },
  "fields": {
    "data.title": { "read": ["$public"], "update": ["$owner"] }
  }
}
```

服务端会在运行时 normalize 成 v2。控制台保存默认写 v2。

## 管理 API

控制台使用以下接口：

| 接口 | 用途 |
|------|------|
| `GET /api/v1/apps/:appId/policies` | 列出 app 下全部策略 |
| `PUT /api/v1/apps/:appId/policies` | upsert app/dataType/record 策略 |
| `POST /api/v1/apps/:appId/policies/explain` | 模拟一次决策 |
| `POST /api/v1/apps/:appId/policies/preview-migration` | 预览 v1 → v2 归一化 |

`explain` 入参示例：

```json
{
  "scope": "dataType",
  "target": "post",
  "action": "read",
  "fieldPath": "data.title",
  "actor": {
    "userId": "user_1",
    "role": "user",
    "authType": "restricted",
    "ownerId": "user_1",
    "appAdmin": false,
    "systemAdmin": false,
    "origin": "system"
  },
  "currentValue": { "title": "Hello" },
  "dataValue": { "title": "Hello" }
}
```

返回结构包含：

```json
{
  "decision": { "allow": true, "reason": "field-permission", "matchedRuleId": "public-read-title" },
  "trace": []
}
```

## 安全边界

- PolicyDocument 是应用层权限，不是数据库 RLS。
- 所有 Data / Realtime 写读入口必须走 PolicyEngine。
- 旧文档可兼容读取，但新配置应写 v2。
- `deny` 规则暂不启用，避免优先级复杂化。

## 代码位置

- DSL 解析：`src/shared/policy/document.ts`
- 引擎入口：`src/shared/policy/engine.ts`
- 变量评估：`src/shared/policy/variables.ts`
- 动态评估：`src/shared/policy/dynamic.ts`
- 通配符匹配：`src/shared/policy/wildcard.ts`
- 管理服务：`src/modules/policies/service.ts`
- SDK 构造器：`packages/sdk-core/src/policy.ts`