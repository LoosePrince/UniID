# UniID

面向静态站点与纯前端的统一身份、数据与文件服务。通过 **iframe + SDK** 接入，在无需自建后端的前提下，提供认证、Schema 约束的数据库、对象存储，以及类 Supabase 的 Realtime、Edge Functions、Cron、Webhooks、配额与审计能力。

**技术栈：** Next.js 14 · React 18 · TypeScript · Prisma · SQLite · QuickJS 沙箱 · SSE

---

## 特性

| 能力 | 说明 |
|------|------|
| **认证** | iframe 授权页 + `postMessage` 握手；Access JWT + 不透明 Refresh（轮换即作废族） |
| **信任链** | 浏览器 Origin × `parent_origin` × 应用注册域名 三角校验 |
| **数据** | JSON Schema + AutoFill（`$serverTime` / `$userId` 等）+ 字段级 Policy DSL |
| **文件** | S3 兼容存储；简单上传 + 分片上传；图片宽高自动提取 |
| **Realtime** | SSE 频道订阅；`records` / `query` / `broadcast` / `presence` |
| **Functions** | QuickJS 沙箱执行用户代码；版本化部署与调用日志 |
| **Cron** | `node-cron` 进程内调度（单实例设计） |
| **Webhooks** | 领域事件投递；HMAC-SHA256 签名；指数退避 + DLQ |
| **配额 / 限流** | 按应用 RPS 令牌桶 + 日 API / 月存储 / 日函数调用配额 |
| **审计** | 写操作与登录/授权事件 best-effort 落库 |
| **控制台** | 开发者控制台 + 账号中心 + 系统管理（用户/应用/全局配额） |

---

## 快速开始

### 环境要求

- Node.js 18+
- Windows 上 `argon2` 可能需要 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)（C++ 工作负载）

### 安装与初始化

```powershell
# 克隆后进入项目目录
npm install

# 复制环境变量并填写密钥（见下方「环境变量」）
Copy-Item .env.example .env
# AUTH_JWT_SECRET、SESSION_COOKIE_SECRET 至少 32 字节随机值，例如：
# [Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))

# 数据库
npx prisma generate
npx prisma migrate dev
npm run prisma:seed

# 开发服务器
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。

### Seed 默认账号

| 用户名 | 密码 | 说明 |
|--------|------|------|
| `admin` | `admin12345` | 系统管理员 |
| `alice` | `password` | 演示用户 |
| `bob` | `password` | 演示用户 |

演示应用主域名：`localhost:5500`（可用 `demo/index.html` 配合本地静态服务器验证 SDK）。

### 验证构建与测试

```powershell
npm run typecheck   # TypeScript
npm test            # Vitest 单元测试（49 项）
npm run build       # Next.js 生产构建
npm run sdk:build   # @uniid/sdk + react + vue
npm run e2e         # Playwright 烟测（需先 build 或由 playwright 启动 start）
```

---

## 架构概览

```
静态站点 / SPA
    │  @uniid/sdk（auth / data / files / realtime / functions）
    │  iframe → /embed（授权页）
    ▼
Next.js App Router（app/）
    │  defineRoute + withCors + requireSdkAuth / requireConsoleAuth
    ▼
src/modules/          领域服务（auth, apps, data, schema, files, realtime, functions, cron, webhooks, admin）
src/shared/           IAM、Policy、Validator、Sandbox、Bus、Quota、Audit、Storage…
    ▼
Prisma + SQLite       data/uniid.db
    │  bus.emit → Realtime fanout / Webhook 投递 / Audit 监听
    ▼
S3 兼容对象存储（可选，文件模块）
```

启动时 `instrumentation.ts` 会注册：**Cron 调度**、**Webhook 事件订阅**、**Audit 监听器**（仅 Node 运行时）。

更细的说明见 [docs/architecture.md](docs/architecture.md)。

---

## 目录结构

```
app/
  (auth)/login, register          # 登录 / 注册
  (account)/account/*             # 账号中心
  (console)/console/*             # 开发者控制台
  embed/                          # iframe 授权页
  api/v1/*                        # REST API
src/
  modules/                        # 领域用例（各模块 service.ts）
  shared/                         # 基础设施（iam, policy, sandbox, bus…）
  ui/                             # 设计系统 + 控制台组件
packages/
  sdk-core/                       # @uniid/sdk
  sdk-react/                      # @uniid/sdk-react
  sdk-vue/                        # @uniid/sdk-vue
prisma/                           # schema + migrations + seed
docs/                             # 架构 / API / SDK / Policy / Functions
demo/                             # 纯 HTML SDK 演示页
e2e/                              # Playwright 烟测
```

---

## SDK 接入（最小示例）

### 浏览器（UMD）

构建 SDK 后，将 `packages/sdk-core/dist/uniid.umd.global.js` 挂到静态页，或参考 [demo/index.html](demo/index.html)。

### TypeScript

```ts
import { UniID } from "@uniid/sdk";

const uniid = new UniID({
  url: "http://localhost:3000",
  appId: "<你的 appId>",
  autoRefresh: true
});

// 登录（打开 iframe 授权）
await uniid.auth.login({ authType: "full" });

// 查询数据
const { items } = await uniid
  .from("post")
  .select(["id", "data.title", "data.status"])
  .where({ "data.status": "published" })
  .limit(20)
  .run();

// 实时订阅
const ch = uniid.realtime
  .channel("records:post")
  .on("record.created", (e) => console.log(e))
  .subscribe();
```

React / Vue 适配、分片上传、Policy 构造器等见 [docs/sdk.md](docs/sdk.md)。

---

## 控制台与主要路由

| 路径 | 用途 |
|------|------|
| `/login` `/register` | 控制台 / 账号登录 |
| `/console` | 应用列表 |
| `/console/apps/[appId]` | 应用概览 |
| `/console/apps/[appId]/schemas` | Schema 管理 |
| `/console/apps/[appId]/data` | 数据浏览 |
| `/console/apps/[appId]/files` | 文件 |
| `/console/apps/[appId]/functions` | Edge Functions |
| `/console/apps/[appId]/cron` | 定时任务 |
| `/console/apps/[appId]/webhooks` | Webhooks |
| `/console/apps/[appId]/members` | 成员 |
| `/console/apps/[appId]/settings` | 设置 / 域名 / 配额 / 危险区 |
| `/console/admin/*` | 系统管理（需 `admin` 角色） |
| `/account` | 用户账号中心 |
| `/embed` | SDK iframe 授权页 |

API 前缀：`/api/v1/...`，错误响应为统一 envelope。完整列表见 [docs/api.md](docs/api.md)。

---

## npm 脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发服务器（:3000） |
| `npm run build` | 生产构建 |
| `npm run start` | 生产模式启动 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest 单元测试 |
| `npm run e2e` | Playwright 烟测 |
| `npm run prisma:generate` | 生成 Prisma Client |
| `npm run prisma:migrate` | 开发迁移 |
| `npm run prisma:seed` | 写入演示数据 |
| `npm run prisma:reset` | 重置库并重新迁移（**会清空数据**） |
| `npm run sdk:build` | 构建三个 SDK 包 |
| `npm run lint` | ESLint |

---

## 环境变量

从 [.env.example](.env.example) 复制为 `.env`。常用项：

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | SQLite 路径，默认 `file:./data/uniid.db` |
| `AUTH_JWT_SECRET` | SDK Access JWT 签名密钥（必填，≥32 字节） |
| `SESSION_COOKIE_SECRET` | 控制台 Cookie 会话密钥（必填） |
| `PUBLIC_URL` | 对外 URL，默认 `http://localhost:3000` |
| `S3_*` | 对象存储；留空时文件上传相关功能不可用 |
| `FN_FETCH_WHITELIST` | 函数沙箱 `uniid.fetch` 允许的主机列表（逗号分隔，空=禁止出站） |
| `QUOTA_*` | 新应用默认配额 |

---

## 策略与 Schema（简述）

- **Schema**：每个 `dataType` 注册 JSON Schema + 可选 `autoFill` / `validationRules`（QuickJS）。
- **Policy**：`PolicyDocument` 支持 app / dataType / record 三级覆盖；字段路径通配符；动态变量如 `$owner`、`$dynamic:likes.$user`。
- **写入流水线**：AutoFill → AJV → validationRules → PolicyEngine 字段级校验 → 持久化 → `bus.emit`。

详见 [docs/policy.md](docs/policy.md)。

---

## 文档索引

| 文档 | 内容 |
|------|------|
| [docs/architecture.md](docs/architecture.md) | 分层、请求生命周期、模块职责 |
| [docs/api.md](docs/api.md) | REST API 端点与约定 |
| [docs/sdk.md](docs/sdk.md) | SDK API、React/Vue、Realtime、分片上传 |
| [docs/policy.md](docs/policy.md) | Policy DSL 与示例 |
| [docs/functions.md](docs/functions.md) | Edge Functions 沙箱与 `handler` 约定 |

---

## 生产部署注意

1. **密钥**：生产环境必须设置强随机 `AUTH_JWT_SECRET` 与 `SESSION_COOKIE_SECRET`，勿提交 `.env`。
2. **SQLite**：适合单机与小规模；多实例部署需迁移到 PostgreSQL 等并调整 Prisma datasource。
3. **Cron / Webhook 重试**：当前为**单进程**设计（`node-cron` + `setTimeout` 重试）；水平扩展需外置调度与队列。
4. **S3**：文件与分片上传依赖 S3 兼容端点；未配置时仅元数据/数据库能力可用。
5. **构建**：`npm run build` 已通过；Server 端依赖 `node:` 内置模块与 `node-cron` 已在 `next.config.mjs` 中 externalize。

---

## 设计说明

本仓库 README 描述 **UniID v2 当前实现**。若你看到旧版文档中的 NextAuth、tRPC、WebSocket 等表述，请以 `src/`、`prisma/schema.prisma` 与 `docs/` 为准。

UI 采用米色简约主题（cream / sand / ink），控制台与 iframe 授权页风格一致，见 `app/globals.css` 与 `app/design`。
