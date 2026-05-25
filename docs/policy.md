# 权限策略（PolicyDocument）

UniID 的 PolicyEngine 把权限当作 **可组合的文档**：`app default → dataType default → record override`，后者覆盖前者。

## 文档结构

```jsonc
{
  "default": {
    "read":   ["$public"],
    "write":  ["$owner", "$app_admin"]
  },
  "fields": {
    "data.title":   { "read": ["$public"], "update": ["$owner"] },
    "data.likes":   { "read": ["$public"], "increment": ["$dynamic:likes.$user"] },
    "data.private.*": { "read": ["$owner"] }
  }
}
```

字段路径支持通配符 `*`，匹配按"最具体优先"。

## 变量

| 变量 | 含义 |
|------|------|
| `$public`         | 任何人 |
| `$all`            | 已登录的任意用户 |
| `$owner`          | 记录的 `ownerId === ctx.userId` |
| `$app_admin`      | 当前 App 的管理员 |
| `$system_admin`   | UniID 系统管理员 |
| `$user:{id}`      | 特定用户 |
| `$role:{role}`    | 用户角色匹配 |
| `$function:{name}`| Edge Function 身份（在沙箱内） |
| `$dynamic:{path}` | 动态规则：写操作时比较新旧值（详见下） |

## 动态规则

`$dynamic:path.$user` 表示**该字段下只允许操作"以当前用户 id 为 key"的项**。典型用法：点赞 / 投票计数。

例：

```jsonc
{
  "fields": {
    "data.likes": {
      "increment": ["$dynamic:likes.$user"]
    }
  }
}
```

当请求 `POST /api/v1/data/record/:id/ops` 携带：

```json
{ "ops": [{ "type": "increment", "path": "data.likes.<userId>", "value": 1 }] }
```

PolicyEngine 会检查 `<userId> === ctx.userId`，从而保证用户只能给自己计数。

## 多动作

| 动作 | 何时检查 |
|------|----------|
| `read`      | GET / query / SSE filterReadable |
| `write`     | 缺省 fallback：当 create/update/... 都未声明时用 |
| `create`    | 新建记录 |
| `update`    | 部分/整体更新 |
| `increment` | 原子加减 |
| `push`      | 数组追加 |
| `delete`    | 软删除 |

## 评估流程

1. `system_admin` → 直通
2. `ctx.user === resource.owner` 且文档允许 `owner` → 直通
3. 收集合并文档；按字段路径定位 rule（最具体优先）
4. 评估变量（静态变量）
5. 评估 `$dynamic:*`（如需 newValue / prevValue）
6. 限制授权 (`authType=restricted`)：只允许 `$role:app_admin` / `$role:system_admin` 之外的 `$user:*` 与 `$public`

## `explain` 模式

控制台的"权限模拟器"调用 `PolicyEngine.explain(ctx, action, resource)` 返回决策路径：

```ts
{
  allow: true,
  trace: [
    { stage: "shortcut", info: "owner" },
    { stage: "field-match", path: "data.title", rule: { read: ["$public"] } },
    { stage: "variable", var: "$public", result: true }
  ]
}
```

## 读权限过滤

`PolicyEngine.filterReadable(data, ctx, resource)` 把整条记录按字段读权限收缩，用于查询返回与 SSE。

## 落地

- DSL 解析：`src/shared/policy/document.ts`
- 通配符匹配：`src/shared/policy/wildcard.ts`
- 变量评估：`src/shared/policy/variables.ts`
- 动态评估：`src/shared/policy/dynamic.ts`
- 引擎入口：`src/shared/policy/engine.ts`
- 单测：`src/shared/policy/__tests__/engine.test.ts`
