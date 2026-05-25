# 架构总览

> 关键词：**纯前端可用** · **iframe + SDK 接入** · **域名绑定信任链** · **细粒度策略引擎** · **领域分层**

## 1. 设计原则

| 维度 | 含义 |
|------|------|
| 三即一服务 | UniID 同时提供 Auth、Data、File，以及 Realtime / Functions / Cron / Webhook |
| 零后端可用 | 任何静态站点只要域名注册到 UniID 即可获得 BaaS 能力 |
| 可信身份链 | 浏览器 Origin × `postMessage.origin` × `App.domain` 三角校验 |
| 细粒度权限 | `PolicyDocument` DSL：字段级 / 动态变量 / 通配符 / 多操作分类 |
| Schema 强制 | 所有写入必须命中已注册 Schema；`autofill` 防伪造 |
| 域名绑定 | `primaryDomain` + `AppDomain[]` 支持多域名 |

## 2. 分层

```
app/              Next.js 路由 + 页面（仅做编排）
src/modules/      领域用例（auth/apps/data/schema/files/realtime/functions/cron/webhooks）
src/shared/       基础设施（iam/policy/validator/storage/sandbox/bus/cors/errors/http/...）
src/ui/           设计令牌 + Radix-based primitives + 控制台组件
prisma/           数据模型（Prisma + SQLite WAL）
packages/         独立的 SDK 子包（sdk-core / sdk-react / sdk-vue）
```

## 3. 请求生命周期

```
 Browser ──► CORS preflight ──► withCors(policy)
        ──► requireSdkAuth (verify JWT + AppDomain match)
        ──► defineRoute(zod input/output validation)
        ──► PolicyEngine.evaluate(action, resource)
        ──► DataPipeline (autofill → AJV → field-level policy → write)
        ──► bus.emit(...)  ──► Realtime / Webhook / Audit 异步订阅
        ──► errorEnvelope (统一错误)
```

## 4. 数据流（写入）

1. Resolve PolicyDocument（app + dataType + record override）
2. Resolve Schema active version
3. AutoFill（`$serverTime` / `$userId` / `$uuid` / `$prevValue`）
4. AJV 校验合并后的 data
5. 自定义 validationRules（QuickJS 沙箱）
6. PolicyEngine 字段级权限
7. Repository 写入（事务）
8. `bus.emit("record.*", envelope)`

## 5. 关键模块

- **PolicyEngine** (`src/shared/policy`) — 解析合并的 PolicyDocument、支持变量与动态规则、提供 `evaluate`/`explain`/`filterReadable`。
- **IAM** (`src/shared/iam`) — Argon2id 密码、jose HS256 access JWT、不透明 refresh 一次性轮换、`requireSdkAuth`/`requireConsoleAuth` 信任链。
- **DataPipeline** (`src/modules/data`) — 写入流水线。
- **QueryBuilder** — DSL → Prisma raw SQL + `json_extract`（SQLite）。
- **Realtime** — `Map<channel, Set<conn>>` + SSE 心跳 + Last-Event-ID 重放。
- **QuickJS Sandbox** — Functions 沙箱（内存/时间/host 白名单）。
- **EventBus** — `bus.emit("record.created", payload)` 跨模块异步订阅。

详见各模块的 `service.ts` 文件头注释。
