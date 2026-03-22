# UniID - 统一认证与数据服务架构设计文档

## 一、系统概述

### 1.1 项目目标
构建一个统一的认证与数据存储服务，通过iframe嵌入方式为多个静态网站提供：
- 统一的用户认证和会话管理
- 灵活的、细粒度权限控制的数据存储
- 基于授权机制的应用接入

### 1.2 核心特性
- **授权制接入**：网站需获得用户授权才能访问数据
- **双模式授权**：完整授权（账户级）和限制授权（数据级）
- **字段级权限**：支持对JSON数据的每个字段单独设置权限
- **动态权限变量**：支持用户ID等变量作为权限路径
- **权限细分**：支持 `create` (新增)、`update` (修改)、`increment` (增量)、`push` (追加) 等细粒度操作
- **后端自动填充**：支持在存储前自动设置服务器时间、用户ID、UUID等，防止伪造

### 1.3 技术选型

- 前端框架：Next.js 14+ (App Router)
- UI 框架：React 18+
- 语言：TypeScript 5+
- 数据库：SQLite + Prisma ORM
- 认证：NextAuth.js / Auth.js + Jose (JWT)
- API：Next.js Route Handlers
- 状态管理：React Hooks

## 二、系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                   客户端网站 (静态托管)                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              iframe (嵌入登录页面)                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                        ↓ postMessage                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Auth SDK (CDN)                         │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ↓ HTTPS
┌─────────────────────────────────────────────────────────────┐
│                 Next.js 统一认证服务                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   Next.js App Router                 │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │  Route Handlers  │  Server Components │  tRPC       │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │         NextAuth.js (认证)  │  WebSocket Server     │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │     Prisma Client  │  Permission Engine  │  Cache  │   │
│  └─────────────────────────────────────────────────────┘   │
│                              ↓                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                 SQLite 数据库                        │   │
│  │         (better-sqlite3 + 连接池)                    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 三、数据库设计

### 3.1 核心表结构 (SQLite)

```sql
-- 用户表
CREATE TABLE users (
    id TEXT PRIMARY KEY,                    -- 用户ID (CUID)
    username TEXT UNIQUE NOT NULL,           -- 用户名
    passwordHash TEXT NOT NULL,              -- 密码哈希
    email TEXT UNIQUE,                        -- 邮箱
    role TEXT DEFAULT 'user',                  -- 角色: admin/user
    createdAt INTEGER NOT NULL,               -- 创建时间戳
    updatedAt INTEGER NOT NULL,                -- 更新时间戳
    settings TEXT,                              -- 用户设置(JSON字符串)
    deleted INTEGER DEFAULT 0                    -- 软删除标记
);

-- 会话表
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,                       -- 会话ID
    userId TEXT NOT NULL,                      -- 用户ID
    token TEXT UNIQUE NOT NULL,                -- 访问令牌
    refreshToken TEXT UNIQUE,                  -- 刷新令牌
    expiresAt INTEGER NOT NULL,                -- 过期时间
    createdAt INTEGER NOT NULL,                -- 创建时间
    lastActivity INTEGER,                      -- 最后活动时间
    userAgent TEXT,                            -- 用户代理
    FOREIGN KEY (userId) REFERENCES users(id)
);

-- 应用(网站)表
CREATE TABLE apps (
    id TEXT PRIMARY KEY,                       -- 应用ID
    name TEXT NOT NULL,                        -- 应用名称
    domain TEXT UNIQUE NOT NULL,               -- 应用域名
    description TEXT,                          -- 应用描述
    createdAt INTEGER NOT NULL,                -- 创建时间
    ownerId TEXT NOT NULL,                     -- 创建者ID
    status TEXT DEFAULT 'active',              -- 状态
    apiKey TEXT UNIQUE,                        -- API密钥
    settings TEXT,                             -- 应用设置(JSON字符串)
    FOREIGN KEY (ownerId) REFERENCES users(id)
);
-- 应用管理员通过 AppAdmin 关联表维护 (appId, userId)

-- 授权表
CREATE TABLE authorizations (
    id TEXT PRIMARY KEY,                       -- 授权ID
    userId TEXT NOT NULL,                      -- 用户ID
    appId TEXT NOT NULL,                       -- 应用ID
    authType TEXT NOT NULL,                    -- 授权类型: full/restricted
    grantedAt INTEGER NOT NULL,                -- 授权时间
    expiresAt INTEGER,                         -- 过期时间(空表示永久)
    revoked INTEGER DEFAULT 0,                 -- 是否撤销
    permissions TEXT,                          -- 额外权限配置(JSON字符串)
    UNIQUE(userId, appId),
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (appId) REFERENCES apps(id)
);

-- 数据记录表 (核心灵活存储)
CREATE TABLE records (
    id TEXT PRIMARY KEY,                       -- 记录ID
    appId TEXT NOT NULL,                       -- 所属应用
    ownerId TEXT,                              -- 所有者ID(空表示应用级数据)
    dataType TEXT NOT NULL,                    -- 数据类型(如: post, form)
    data TEXT NOT NULL,                        -- 实际数据(JSON字符串)
    permissionOverride TEXT,                   -- 权限配置(JSON字符串，可选)
    createdAt INTEGER NOT NULL,                -- 创建时间
    updatedAt INTEGER NOT NULL,                -- 更新时间
    createdById TEXT,                          -- 创建者ID
    updatedById TEXT,                          -- 更新者ID
    deleted INTEGER DEFAULT 0,                 -- 软删除
    schemaVersion INTEGER,                     -- 所用 Schema 版本(可选)
    FOREIGN KEY (appId) REFERENCES apps(id),
    FOREIGN KEY (ownerId) REFERENCES users(id),
    FOREIGN KEY (createdById) REFERENCES users(id),
    FOREIGN KEY (updatedById) REFERENCES users(id)
);

-- NextAuth.js 账户表 (OAuth支持)
CREATE TABLE accounts (
    id TEXT PRIMARY KEY,                       -- 账户ID
    userId TEXT NOT NULL,                      -- 用户ID
    type TEXT NOT NULL,                        -- 账户类型
    provider TEXT NOT NULL,                    -- 提供商
    providerAccountId TEXT NOT NULL,           -- 提供商账户ID
    refresh_token TEXT,                        -- 刷新令牌
    access_token TEXT,                         -- 访问令牌
    expires_at INTEGER,                        -- 过期时间
    token_type TEXT,                           -- 令牌类型
    scope TEXT,                                -- 授权范围
    id_token TEXT,                             -- ID令牌
    session_state TEXT,                        -- 会话状态
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(provider, providerAccountId)
);

-- NextAuth.js 验证令牌表
CREATE TABLE verification_tokens (
    identifier TEXT NOT NULL,                  -- 标识符
    token TEXT UNIQUE NOT NULL,                -- 令牌
    expires DATETIME NOT NULL,                 -- 过期时间
    UNIQUE(identifier, token)
);
```

### 3.2 权限数据结构

```sql
-- records表的permissionOverride字段JSON结构示例（未设置时使用应用/数据类型默认权限）
    "default": {
        "read": ["$public"],           -- 默认读权限
        "create": ["$owner"],          -- 默认新增权限
        "update": ["$owner"],          -- 默认更新权限
        "delete": ["$owner"]           -- 默认删权限
    },
    "fields": {
        "data.title": {
            "read": ["$all"],
            "update": ["$owner"]
        },
        "data.metadata.comments": {
            "read": ["$all"],
            "create": ["$dynamic:comments.$user"],       -- 仅允许在该路径下新增属于自己的内容
            "update": ["$dynamic:comments.$user.userId"], -- 强制校验内容内部的 userId 字段必须匹配
            "delete": ["$owner"]
        }
    }
}

-- 权限操作说明
-- read: 读取数据
-- write: 综合写权限（兼容旧版，包含 create/update/increment/push）
-- create: 在对象或数组中新增键值对
-- update: 修改已存在的键值对
-- increment: 对数值字段进行增量操作
-- push: 对数组进行追加操作
-- delete: 删除记录或字段

-- 动态变量说明
-- $owner: 记录所有者
-- $all: 所有已认证用户
-- $public: 所有人(包括未认证)
-- $app: 应用自身
-- $user:{id}: 指定用户
-- $role:{role}: 指定角色
-- $dynamic:{path}: 动态路径，{path}中的$user会被替换为当前用户ID

-- 通配符权限支持
-- 使用 * 匹配任意路径段，支持子级覆盖父级
-- 示例：
--   "likes.*.time" 匹配 "likes.user123.time"
--   "likes.*" 匹配 "likes.user123"
--   "*" 匹配任意单层路径
-- 权限继承规则：子级配置覆盖父级配置，最长匹配优先
```

## 四、授权流程

### 4.1 授权状态码
```
授权类型:
- full: 完整授权(账户级权限)
- restricted: 限制授权(仅数据级)

权限级别:
- 0: 无权限
- 1: 可读
- 2: 可写(含读)
- 3: 可删(含读写)
```

### 4.2 授权验证逻辑
```
1. 用户访问网站 -> 网站检查是否有有效token
2. 无token -> 显示登录按钮，点击后iframe弹出登录页
3. 用户在统一登录页登录 -> 显示授权确认页面
   - 显示申请授权的网站信息（应用名称、描述、域名、ID）
   - 横竖屏自适应布局（桌面端双栏，移动端全贴合）
   - 提供授权类型选择(完整/限制)
4. 用户确认授权 -> 生成授权记录和token
5. token通过postMessage返回给网站
6. 网站保存token，后续API调用携带token
```

### 4.3 可信授权链路

授权流程**全程只信任浏览器生成的 Origin**，不信任任何可自定义内容（URL 参数、`event.data` 等），确保父页面身份不可伪造。

#### 可信来源（握手协议）

| 环节 | 可信来源 | 说明 |
|------|----------|------|
| 请求来自 UniID | HTTP `Origin` 头 | 由 `isSameOriginAuthRequest` 校验，确保请求发自 UniID 自身 |
| 父页面身份 | `postMessage` 的 `event.origin` | 浏览器在 `postMessage` 时自动设置，父页面无法伪造 |
| 应用域名匹配 | `parent_origin`（来自 `event.origin`） | Embed 仅从 `event.origin` 读取并传给后端，与 `app.domain` 比对 |

#### 流程说明

1. **父页面发起**：父页面（如 `http://example.com`）加载 SDK，创建 iframe `src="/embed?app_id=xxx"`（不传 `parent_origin`，传了也没用）
2. **授权页初始化并检查登录**：Embed 页面根据 `app_id` 调用 `/api/auth/check`，如果未登录则跳转到 `/login?redirectTo=/embed?app_id=xxx`，登录完成后再回到 Embed。
3. **授权页就绪广播**：当 Embed 确认用户已登录并进入授权界面时，向父页面广播 `postMessage({ type: "uniid_ready", appId })`。
4. **SDK 发起授权请求**：SDK 监听到 `uniid_ready` 后，使用浏览器提供的 `event.origin` 作为父页面 Origin，向 iframe 发送 `postMessage({ type: "uniid_authorize_request", appId })`。
5. **Embed 锁定父页面 Origin**：Embed 收到 `uniid_authorize_request` 时，从 `event.origin` 读取并锁定 `parent_origin`，后续只向该 Origin 回传结果。
6. **授权请求**：用户点击「同意并授权」时，Embed 将 `parent_origin`（来自前一步的 `event.origin`）随请求体发送给 `/api/auth/authorize`。
7. **后端校验**：
   - 请求 `Origin` 必须在 `AUTH_ALLOWED_ORIGINS` 内（未配置时使用 `NEXTAUTH_URL`/`AUTH_URL`），即请求来自 UniID 自身
   - 必须提供 `parent_origin`，否则 400
   - `parent_origin` 的 host 必须与 `app.domain` 一致，否则 403

#### 不可信来源（已排除）

- URL 参数 `parent_origin`：父页面可篡改
- `event.data` 中的任何字段：父页面可伪造
- 自定义请求头（如 `X-Parent-Origin`）：客户端可伪造

## 五、API设计

**CORS 与 Origin**：认证授权接口 `/api/auth/authorize` 仅接受同源请求（Origin 在 AUTH_ALLOWED_ORIGINS / NEXTAUTH_URL 内）。数据类接口（`/api/data/*`、`/api/app/*`）及 `/api/auth/revoke` 支持跨域：允许的 Origin 为开发环境 `localhost`/`127.0.0.1`，或生产环境中与某应用注册的 `domain` 一致。

### 5.1 认证相关

```
POST /api/auth/login
Request:
{
    "username": "string",
    "password": "string"
}
Response:
{
    "token": "string",
    "refresh_token": "string",
    "expires_in": 3600,
    "user": {
        "id": "string",
        "username": "string",
        "role": "string"
    }
}

POST /api/auth/refresh
Headers:
    Authorization: Bearer {refresh_token}
Response: 同上

POST /api/auth/authorize
（仅同源：Origin 须在 AUTH_ALLOWED_ORIGINS / NEXTAUTH_URL 内，通常由 UniID 站内 embed 页面调用）
Request: Cookie: uniid_token={session_token}
Body:
{
    "app_id": "string",
    "auth_type": "full | restricted",
    "parent_origin": "string",   // 父页面 Origin（来自 postMessage event.origin，必填）
    "scope": "string | null"     // 可选，限制授权作用域(如 data_type 白名单)
}
Response:
{
    "token": "string",
    "refresh_token": "string",
    "expires_in": 3600,
    "user": { "id", "username", "role" },
    "app_id": "string",
    "auth_type": "full | restricted"
}

POST /api/auth/revoke
（跨域：Origin 须与 app.domain 匹配；用于站点侧撤销授权/登出）
Headers:
    Authorization: Bearer {token}
Request:
{
    "app_id": "string"   // 必填
}
Response:
{
    "success": true,
    "message": "Authorization revoked successfully",
    "app_id": "string",
    "revoked_at": 1234567890
}

GET /api/auth/check
Headers:
    Authorization: Bearer {token}
Query Params:
    app_id: string   // 可选，传入时返回应用详情
Response:
{
    "valid": true,
    "user": {...},
    "app": { "id", "name", "description", "domain" } | null,  // 当 app_id 有效且已登录时返回
    "app_id": "string",
    "auth_type": "full/restricted"
}
```

### 5.2 应用管理 API

仅**应用管理员**或**系统管理员**可调用；跨域时 Origin 须在应用注册的 `domain` 对应域名下（或开发环境 localhost）。

```
GET /api/app/{appId}
Headers:
    Authorization: Bearer {token}
Response: 应用详情（含 owner、admins 等），或 404 APP_NOT_FOUND

PATCH /api/app/{appId}
Headers:
    Authorization: Bearer {token}
Request:
{
    "name": "string",           // 可选
    "description": "string",    // 可选
    "settings": "string|object", // 可选
    "status": "string"          // 可选，仅系统管理员可改
}
Response: 更新后的应用对象
```

### 5.3 数据操作API

```
// 创建记录（写入前会按 Schema 校验 data，未配置 Schema 则拒绝）
POST /api/data/{app_id}/{data_type}
Headers:
    Authorization: Bearer {token}
Request:
{
    "data": {...},              // 任意JSON数据，须符合该 data_type 的 Schema
    "permissions": {...},       // 权限配置(可选)
    "skipValidation": false     // 可选，设为 true 可跳过 Schema 校验
}
Response:
{
    "id": "string",
    "created_at": 1234567890,
    "data": {...},
    "permissions": {...}
}

// 读取记录
GET /api/data/record/{record_id}
Headers:
    Authorization: Bearer {token}
Query Params:
    fields: "field1,field2"   // 指定字段(可选)
Response: 记录对象

// 更新记录(部分更新，合并后的 data 会按 Schema 重新校验)
PATCH /api/data/record/{record_id}
Headers:
    Authorization: Bearer {token}
Request:
{
    "data": {...},              // 要更新的字段，合并后须符合 Schema
    "permissions": {...},       // 要更新的权限
    "skipValidation": false     // 可选，跳过 Schema 校验
}
Response: 更新后的记录

// 删除记录
DELETE /api/data/record/{record_id}
Headers:
    Authorization: Bearer {token}

// 删除字段
DELETE /api/data/record/{record_id}/fields/{field_path}
Headers:
    Authorization: Bearer {token}
Response:
{
    "deleted": ["field1", "field2"],
    "remaining": {...}
}

// 批量查询
POST /api/data/query
Headers:
    Authorization: Bearer {token}
Request:
{
    "app_id": "string",
    "data_type": "string",    // 可选
    "filter": {...},           // 过滤条件
    "fields": ["field1"],      // 返回字段
    "sort": {"field": "asc"},
    "limit": 100,
    "offset": 0
}
Response:
{
    "total": 100,
    "items": [...]
}
```

### 5.4 数据模式 (Schema) 管理

#### 5.4.1 说明

UniID 支持为每个应用的每种数据类型 (`dataType`) 定义 **JSON Schema**，用于在写入或更新数据时进行校验。只有符合 Schema 的数据才能存入，否则请求会被拒绝。

- **强制校验**：未配置 Schema 的数据类型无法写入数据，需先注册 Schema
- **版本管理**：支持 Schema 版本演进，每次更新会创建新版本
- **权限控制**：仅应用所有者或管理员可注册/更新 Schema

#### 5.4.2 JSON Schema 规范要点

| 关键字 | 含义 | 示例 |
|--------|------|------|
| `type` | 数据类型 | `"string"`, `"number"`, `"integer"`, `"boolean"`, `"object"`, `"array"` |
| `required` | 必填字段 | `["title", "content"]` |
| `properties` | 字段定义 | `{ "title": { "type": "string", "maxLength": 100 } }` |
| `additionalProperties` | 动态键的值的 schema | 用于 `likes[userId]`、`comments[userId][commentId]` 等 |
| `minLength` / `maxLength` | 字符串长度 | `minLength: 1`, `maxLength: 500` |
| `minimum` / `maximum` | 数值范围 | `minimum: 0` |
| `items` | 数组元素 schema | `{ "type": "string" }` |
| `enum` | 枚举值 | `["draft", "published"]` |

**嵌套对象示例**（如 `likes`、`comments`）：

```json
{
  "likes": {
    "type": "object",
    "additionalProperties": {
      "type": "object",
      "required": ["time"],
      "properties": {
        "time": { "type": "integer", "minimum": 0 }
      }
    }
  }
}
```

#### 5.4.3 API 用法

```
// 注册 Schema（仅应用所有者或管理员）
POST /api/schema/{app_id}/{data_type}
Headers:
    Authorization: Bearer {token}
Request:
{
    "schema": { ... },           // JSON Schema 对象
    "description": "string",     // 可选
    "validationRules": "string", // 可选，自定义 JS 验证规则
    "isActive": true             // 可选，默认 true，设为活跃版本
}
Response:
{
    "id": "string",
    "version": 1,
    "isActive": true,
    "dataType": "string",
    "createdAt": 1234567890
}

// 获取 Schema
GET /api/schema/{app_id}/{data_type}
Headers:
    Authorization: Bearer {token}
Query Params:
    version: 1   // 可选，不传则返回当前活跃版本
Response:
{
    "id": "string",
    "version": 1,
    "isActive": true,
    "schema": { ... },
    "description": "string",
    "validationRules": "string",
    "createdAt": 1234567890
}
```

#### 5.4.4 数据写入时的验证

- **创建记录**：`POST /api/data/{app_id}/{data_type}` 在写入前会校验 `data` 是否符合 Schema
- **更新记录**：`PATCH /api/data/record/{record_id}` 在更新时会对合并后的完整 `data` 重新校验
- **跳过验证**：请求体可传 `skipValidation: true`（需确保有相应权限）

验证失败时返回 400：

```json
{
  "error": "VALIDATION_FAILED",
  "details": ["...", "..."],
  "schemaVersion": 1
}
```

### 5.5 文件存储 API（Object Storage）

文件对象存储使用**私密桶**时，不在业务数据里存放桶直链。API 返回的 `downloadUrl` 为**相对路径**（`/api/files/{appId}/{fileId}.{ext}`，`ext` 来自原始文件名，仅美化 URL）。访问该路径时：

- **默认**：服务端在校验登录或 `share_token` 后返回 **302**，`Location` 为存储桶的 **S3 预签名 GET URL**，浏览器与 `<img src>` 跟随重定向后**流量直连对象存储**，应用不承担文件字节转发。
- **可选**：`GET /api/files/{appId}/{fileId}.{ext}?proxy=1` 走应用内**流式代理**（适用于不便使用预签名的环境或调试）。

预签名有效期由 `FILE_PRESIGN_EXPIRES_SECONDS` 控制。签名使用的 endpoint 优先为 `OBJECT_STORAGE_ENDPOINT_EXTERNAL`（公网客户端必须能访问该主机上的桶路径）。

#### 5.5.1 环境变量

- `OBJECT_STORAGE_ENDPOINT_INTERNAL`: 对象存储内部 endpoint（S3 兼容，集群内）
- `OBJECT_STORAGE_ENDPOINT_EXTERNAL`: 对象存储外部可访问 endpoint（本地开发或公网 Worker 无法解析内部域名时必填）
- `OBJECT_STORAGE_BUCKET`: 存储桶
- `OBJECT_STORAGE_ACCESS_KEY`: 访问密钥
- `OBJECT_STORAGE_SECRET_KEY`: 密钥
- 下载链接由 API 返回**相对路径**（如 `/api/files/{appId}/{fileId}.png`），客户端使用与鉴权一致的 **应用根地址**（如 SDK 的 `authServer`）拼接后再请求；上传时可传表单字段 `appId` 以写入 `FileObject.appId` 并固定 URL 命名空间
- `FILE_MAX_SIZE_BYTES`: 上传大小上限（默认 10MB）
- `FILE_PRESIGN_EXPIRES_SECONDS`: 预签名 GET 有效期（秒，默认 300，范围 60～604800）
- `FILE_ALLOWED_MIME_TYPES`: 允许的 MIME 列表（逗号分隔，`*` 表示不限制）
- `FILE_SHARE_TOKEN_EXPIRES_IN_SECONDS`: 分享 token 默认有效期（秒）

#### 5.5.2 管理员可配置权限策略

通过系统管理员接口 `PATCH /api/admin/config` 写入 `key=file_policy` 实现策略更新，`value` 为 JSON 字符串。

示例：

```json
{
  "upload": {
    "allowAuthenticated": false,
    "allowedRoles": ["admin"]
  },
  "download": {
    "ownerOnly": true,
    "adminCanDownloadAll": true,
    "allowShareToken": true
  },
  "delete": {
    "ownerCanDelete": true,
    "adminCanManageAll": true
  }
}
```

#### 5.5.3 首期接口

```text
POST   /api/files/upload
DELETE /api/files/{fileId}
GET    /api/files/{fileId}/download-url
GET    /api/files/{appId}/{fileId}.{ext}
GET    /api/files?scope=own|all
POST   /api/files/share
DELETE /api/files/share
GET    /api/files/public/{token}
```

简要说明：
- `upload`: multipart/form-data 上传，字段名 `file`，可选 `appId`（用于 URL 与 `FileObject.appId`）
- `download-url`: 返回 JSON，其中 `downloadUrl` 为**相对路径**（`/api/files/{appId}/{fileId}.{ext}` 或带 `share_token`）；可传 `?share_token=...` 校验分享令牌
- `GET /api/files/{appId}/{fileId}.{ext}`：默认 **302 → 预签名直链**；`?proxy=1` 时为应用内流式代理。默认 **`Content-Disposition: inline`**（浏览器内预览，不强制另存为）；需要强制下载时加 **`?download=1`**。需登录且有权下载，或带有效 `share_token`
- `share`:
  - `POST` 创建分享 token（`{ fileId, expiresInSeconds? }`）
  - `DELETE` 吊销分享 token（`{ token }`）
- `public/{token}`: 公开校验 token 后返回下载地址和文件元信息

#### 5.4.5 后端自动填充 (Auto-fill)

支持在数据存入数据库前由后端强制填充变量，用户无法通过 API 修改这些字段。在 Schema 中通过 `autoFill` 对象配置：

```json
{
  "autoFill": {
    "data.createdAt": "$serverTime",
    "data.authorId": "$userId",
    "data.id": "$uuid"
  }
}
```

**支持的变量：**
- `$serverTime`: 当前 Unix 时间戳（秒）
- `$serverTimeMs`: 当前 Unix 时间戳（毫秒）
- `$userId`: 当前操作者的用户 ID
- `$username`: 当前操作者的用户名
- `$uuid`: 自动生成的唯一标识符（仅在字段为空时生成）
- `$prevValue`: 该字段修改前的值

#### 5.4.6 自定义验证规则示例

`validationRules` 为可选的 JavaScript 代码字符串，在沙箱中执行，返回 `true` 表示通过，返回字符串表示错误信息：

```javascript
// 示例：价格必须非负
if (data.price != null && data.price < 0) {
  return "价格不能为负数";
}
return true;
```

## 六、客户端SDK设计

### 6.1 SDK初始化

```javascript
// uniid.sdk.js (浏览器端 SDK)
const auth = new AuthSDK({
    authServer: 'https://auth.example.com',
    appId: 'my-blog-site',
    mountId: 'auth-iframe-mount',   // 必需：iframe 挂载点元素 ID
    useDefaultStyle: true            // 可选，默认 true：使用 SDK 提供的默认 iframe 样式
});
```

**配置项说明：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `authServer` | string | 是 | UniID 服务地址 |
| `appId` | string | 是 | 应用 ID |
| `mountId` | string | 是 | 挂载点元素 ID，SDK 会替换该元素为 iframe |
| `useDefaultStyle` | boolean | 否 | 默认 `true`。为 `true` 时 SDK 提供居中弹窗、遮罩、圆角、阴影及横竖屏自适应；为 `false` 时需自行编写 iframe 样式 |

### 6.2 默认样式与自适应（useDefaultStyle: true）

当 `useDefaultStyle` 为 `true` 时，SDK 会自动：

- **桌面端**：居中弹窗，带毛玻璃遮罩；根据横竖屏设置宽度（横屏 800px、竖屏 400px）；高度由授权页通过 `uniid_resize` 消息动态上报，实现贴合内容
- **移动端**（宽度 ≤768px）：全贴合全屏（100vw × 100vh），无圆角
- **窗口 resize**：监听窗口大小变化，自动切换横竖版布局

### 6.3 postMessage 协议（新版握手流程）

> 当前代码实现采用「授权页就绪 → SDK 发起授权请求 → 授权页回传结果」的握手模式，不再使用早期的 `uniid_init` / `uniid_open_login` 协议。

| 方向 | type | 说明 |
|------|------|------|
| 子 → 父 | `uniid_ready` | 授权页加载并完成登录状态检查后广播「已就绪」，携带 `appId` |
| 父 → 子 | `uniid_authorize_request` | SDK 收到 `uniid_ready` 后，向授权页发送授权请求，携带 `appId`，用于建立可信父页面身份（origin） |
| 子 → 父 | `uniid_login_success` | 授权成功，携带 `token`、`user`、`app_id`、`auth_type` |
| 子 → 父 | `uniid_login_cancel` | 用户取消授权 |
| 子 → 父 | `uniid_resize` | 授权页上报内容高度 `{ height: number }`，用于桌面端 iframe 高度自适应 |

### 6.4 SDK 核心实现（伪代码）

```javascript
// uniid.sdk.js (浏览器端 SDK)
class AuthSDK {
    constructor(config) {
        if (!config || !config.mountId) {
            throw new Error("AuthSDK: mountId is required to initialize iframe.");
        }
        this.authServer = config.authServer.replace(/\/+$/, '');
        this.appId = config.appId;
        this.mountId = config.mountId;
        this.token = null;
        this.iframe = null;
        this.loginResolver = null;
        this.useDefaultStyle = config.useDefaultStyle !== false;
        this._restoreTokenFromCookie();
        this._init();
    }

    // 从 Cookie 恢复 token
    _restoreTokenFromCookie() {
        var token = this._getCookie("uniid_sdk_token");
        if (token) {
            this.token = token;
        }
    }

    _getCookie(name) {
        var value = "; " + document.cookie;
        var parts = value.split("; " + name + "=");
        if (parts.length === 2) {
            return parts.pop().split(";").shift() || null;
        }
        return null;
    }

    _setCookie(name, value, maxAgeSeconds) {
        var cookie = name + "=" + encodeURIComponent(value) + "; path=/; SameSite=Lax";
        if (typeof maxAgeSeconds === "number") {
            cookie += "; max-age=" + String(maxAgeSeconds);
        }
        document.cookie = cookie;
    }

    _init() {
        // 创建 iframe 并替换挂载点元素
        var mount = document.getElementById(this.mountId);
        if (!mount || !mount.parentNode) {
            throw new Error("AuthSDK: mount element with id '" + this.mountId + "' not found.");
        }
        var iframe = document.createElement("iframe");
        iframe.src = this.authServer + "/embed?app_id=" + encodeURIComponent(this.appId);
        iframe.id = mount.id;
        iframe.className = mount.className;
        iframe.title = "UniID 授权窗口";
        iframe.style.display = "none";
        mount.parentNode.replaceChild(iframe, mount);
        this.iframe = iframe;

        var self = this;
        window.addEventListener("message", function (event) {
            if (!event.data || typeof event.data !== "object") return;
            if (event.data.type === "uniid_login_success") {
                if (event.data.token) {
                    self.token = event.data.token;
                    self._setCookie("uniid_sdk_token", event.data.token, event.data.expires_in || 3600);
                }
                if (self.loginResolver) {
                    self.loginResolver({
                        token: event.data.token,
                        user: event.data.user || null
                    });
                    self.loginResolver = null;
                }
            }
            // 若收到 uniid_login_cancel，resolve({ token: null, user: null, cancelled: true })
        });
    }

    // 登录（返回 Promise<{ token, user } | { token: null, user: null, cancelled: true }>）
    login() {
        var self = this;
        return new Promise(function (resolve) {
            self.loginResolver = resolve;
            if (self.iframe) {
                self.iframe.style.display = "block";
                self.iframe.focus();
                self.iframe.contentWindow &&
                    self.iframe.contentWindow.postMessage(
                        { type: "uniid_open_login" },
                        self.authServer
                    );
            }
        }).finally(function () {
            if (self.iframe) {
                self.iframe.style.display = "none";
            }
        });
    }

    // 数据操作
    create(type, data, permissions) {
        return this._fetch("POST", "/api/data/" + encodeURIComponent(this.appId) + "/" + encodeURIComponent(type), {
            data: data,
            permissions: permissions || undefined
        });
    }

    read(recordId) {
        return this._fetch("GET", "/api/data/record/" + encodeURIComponent(recordId));
    }

    update(recordId, data, permissions) {
        var body = {};
        if (data != null) body.data = data;
        if (permissions != null) body.permissions = permissions;
        return this._fetch("PATCH", "/api/data/record/" + encodeURIComponent(recordId), body);
    }

    delete(recordId) {
        return this._fetch("DELETE", "/api/data/record/" + encodeURIComponent(recordId));
    }

    deleteField(recordId, fieldPath) {
        return this._fetch(
            "DELETE",
            "/api/data/record/" + encodeURIComponent(recordId) + "/fields/" + encodeURIComponent(fieldPath)
        );
    }

    query(queryParams) {
        var params = queryParams || {};
        params.app_id = this.appId;
        return this._fetch("POST", "/api/data/query", params);
    }

    // 撤销授权/登出
    revoke() {
        var self = this;
        return new Promise(function (resolve, reject) {
            if (!self.token) {
                self._restoreTokenFromCookie();
            }
            if (!self.token) {
                reject(new Error("NO_TOKEN"));
                return;
            }
            fetch(self.authServer + "/api/auth/revoke", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer " + self.token
                },
                credentials: "include",
                body: JSON.stringify({ app_id: self.appId })
            })
                .then(function (res) {
                    if (!res.ok) throw new Error("Revoke failed");
                    self.token = null;
                    self._setCookie("uniid_sdk_token", "", 0);
                    resolve(res.json());
                })
                .catch(reject);
        });
    }

    logout() {
        return this.revoke();
    }

    _fetch(method, path, body, requireAuth) {
        requireAuth = requireAuth !== false; // 默认需要认证；read/query 可传 requireAuth: false 支持未登录访问
        if (requireAuth) {
            if (!this.token) {
                this._restoreTokenFromCookie();
            }
            if (!this.token) {
                return Promise.reject(new Error("NO_TOKEN"));
            }
        }
        // 收到 401 且错误码为 INVALID_TOKEN / AUTHORIZATION_* 时，SDK 会自动清除本地 token
        var url = this.authServer + path;
        var headers = {};
        if (this.token) {
            headers.Authorization = "Bearer " + this.token;
        }
        var init = { method: method, headers: headers, credentials: "include" };
        if (body != null) {
            headers["Content-Type"] = "application/json";
            init.body = JSON.stringify(body);
        }
        return fetch(url, init).then(function (res) {
            if (!res.ok) throw new Error("Request failed with status " + res.status);
            return res.json();
        });
    }
}

// ==================== 权限配置工具 ====================
// AuthSDK.Permissions 提供常用权限配置的快速生成方法：
// - private()     : 仅所有者可见
// - public()      : 所有人可见
// - appOnly()     : 仅同应用用户可见
// - custom(opt)   : 自定义权限
// - withFields()  : 带字段级权限（支持通配符 *）
// - nested(opt)   : 嵌套对象权限
// 详见 SDK 源码注释

// ==================== 数据处理工具 ====================
// AuthSDK.Utils 提供数据操作辅助方法：
// - deepMerge(target, source) : 深合并对象
// - getByPath(obj, path)      : 根据路径获取值
// - setByPath(obj, path, val) : 根据路径设置值
// 详见 SDK 源码注释
```

### 6.5 使用示例

```html
<!-- 网站中引入 SDK -->
<script src="https://auth.example.com/sdk/uniid.sdk.js"></script>

<!-- 在页面中放置挂载点 -->
<div id="auth-iframe-mount"></div>

<script>
const auth = new AuthSDK({
    authServer: 'https://auth.example.com',
    appId: 'my-blog-site',
    mountId: 'auth-iframe-mount',  // 必需：iframe 挂载点元素 ID
    useDefaultStyle: true          // 可选，默认 true，使用 SDK 默认弹窗样式
});

// 登录（显示 iframe 登录窗口）
async function handleLogin() {
    const result = await auth.login();
    console.log('登录成功:', result.user);
}

// 创建帖子（使用通用权限配置）
async function createPost() {
    const post = await auth.create('post', {
        title: 'Hello World',
        content: 'This is my first post'
    }, AuthSDK.Permissions.public());
    return post;
}

// 使用通配符权限（详见 demo/index.html 完整示例）
async function createWithWildcardPermissions() {
    const permissions = AuthSDK.Permissions.withFields({
        'likes': { read: ['$public'], write: ['$dynamic:likes.$user'] },
        'likes.*.time': { read: ['$public'], write: ['$dynamic:likes.$user'], delete: ['$app'] }
    });
    const post = await auth.create('post', data, permissions);
    return post;
}

// 查询帖子
async function getPosts() {
    const posts = await auth.query({
        data_type: 'post',
        filter: {
            'data.metadata.tags': 'test'
        },
        sort: {created_at: 'desc'},
        limit: 10
    });
    return posts;
}

// 撤销授权/登出（调用 POST /api/auth/revoke，请求体带 app_id）
async function handleLogout() {
    await auth.logout();
}

// 登录可能被用户取消：result.cancelled === true
// read / query 在未登录时也可调用（仅返回有读权限的数据）
</script>
```

## 七、安全设计

### 7.1 Token机制
- JWT格式，包含用户ID、应用ID、授权类型
- 短时有效(24小时)，支持刷新
- 每次请求验证签名和权限

### 7.2 权限验证流程
```
1. 解析token -> 获取user_id, app_id, auth_type
2. 验证token有效性(未过期、未撤销)
3. 如果是完整授权:
   - admin用户: 所有操作允许
   - 普通用户: 验证是否为记录所有者
   - 包括限制授权的权限
4. 如果是限制授权:
   - 读取records表的permissions配置
   - 解析动态变量($user等)
   - 逐级验证字段权限
5. 记录操作日志
```

### 7.3 数据隔离
- 按app_id隔离不同应用的数据
- 跨应用数据访问需额外授权
- 敏感字段加密存储

## 八、Demo 示例

- 该页面是一个纯静态的示例博客站点，通过 `<script src="/sdk/uniid.sdk.js"></script>` 引入浏览器版 SDK，并调用统一认证服务完成登录与发帖。
- 源码位于项目根目录的 `demo/index.html`
- **默认样式**：Demo 使用 `useDefaultStyle: true`，无需自定义 iframe 样式即可获得居中弹窗、遮罩及横竖屏自适应效果。
- **数据验证**：以应用管理员身份登录后，Demo 会自动比对并同步 `post` 类型的 Schema，确保发帖、点赞、评论等操作符合验证规则。
