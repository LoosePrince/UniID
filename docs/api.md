# API 概览

所有 REST 接口都返回统一 envelope：

```jsonc
{ "data": { ... }, "requestId": "req_xxx" }
// 或
{ "error": { "code": "DATA_RECORD_NOT_FOUND", "message": "...", "requestId": "req_xxx" } }
```

公共要求：
- `Authorization: Bearer <access_token>` —— SDK 调用必须
- `Origin` 必须匹配 App 注册域名

## Auth

| 方法 | 路径 | CORS | 说明 |
|------|------|------|------|
| POST | `/api/v1/auth/register` | admin-only | 注册账户（UniID 自身页面） |
| POST | `/api/v1/auth/login` | admin-only | 登录（colorset cookie + 返回 session） |
| POST | `/api/v1/auth/authorize` | admin-only | iframe 内授权（生成 access/refresh） |
| POST | `/api/v1/auth/refresh` | app-domain | 刷新 access token |
| POST | `/api/v1/auth/revoke` | app-domain | 吊销当前 (user, app) session |
| GET  | `/api/v1/auth/check` | app-or-admin | 校验 session 有效性 |
| GET  | `/api/v1/auth/sessions` | admin-only | 列出当前用户全部 session |
| POST | `/api/v1/auth/logout` | admin-only | 清除控制台 cookie |
| POST | `/api/v1/auth/change-password` | admin-only | 修改密码（需带原密码） |

## Data

| 方法 | 路径 | 用途 |
|------|------|------|
| GET  | `/api/v1/data/[appId]/[dataType]` | 查询（DSL） |
| POST | `/api/v1/data/[appId]/[dataType]` | 新建 |
| GET    | `/api/v1/data/record/[recordId]` | 读取 |
| PATCH  | `/api/v1/data/record/[recordId]` | 部分更新 |
| PUT    | `/api/v1/data/record/[recordId]` | 整体替换 |
| DELETE | `/api/v1/data/record/[recordId]` | 软删除 |
| POST   | `/api/v1/data/record/[recordId]/ops` | 原子字段操作 |

### 查询 DSL

```json
{
  "where": {
    "data.status": "published",
    "data.tags":   { "$contains": "tech" },
    "createdAt":   { "$gte": 1700000000 },
    "$or": [
      { "ownerId": "$ctx.userId" },
      { "data.visibility": "public" }
    ]
  },
  "select":  ["id", "data.title", "data.tags"],
  "orderBy": [{ "createdAt": "desc" }],
  "limit":   50,
  "cursor":  "opaque"
}
```

### 原子操作

```json
{ "ops": [
  { "type": "increment", "path": "data.likes", "value": 1 },
  { "type": "push",      "path": "data.tags",  "value": "music" }
]}
```

## Files

| 方法 | 路径 | 用途 |
|------|------|------|
| POST   | `/api/v1/files/upload` | 上传（multipart/form-data） |
| GET    | `/api/v1/files/[fileId]` | 元数据 |
| DELETE | `/api/v1/files/[fileId]` | 删除 |
| GET    | `/api/v1/files/[fileId]/download-url` | 预签名 GET URL |
| POST   | `/api/v1/files/share` | 创建分享 token |
| GET    | `/api/v1/files/public/[token]` | 公开下载（302 跳预签名） |

## Realtime

```
GET /api/v1/realtime/stream?app_id=app_xxx&channels=records:post,broadcast:room1
Authorization: Bearer ...
Last-Event-ID: ...   # 可选，60s 内可重放
Accept: text/event-stream
```

返回 SSE 流；事件 payload：

```json
{ "type": "insert", "channel": "records:post", "payload": { ... } }
```

支持频道：
- `records:{appId}:{dataType}` / `records:{appId}:{dataType}:{recordId}`
- `query:{queryHash}`
- `broadcast:{appId}:{name}`
- `presence:{appId}:{name}`

## Functions

| 方法 | 路径 |
|------|------|
| POST | `/api/v1/functions/[fnId]/invoke` |

请求体：`{ "payload": {...} }`；响应：`{ "data": { "invocationId", "status", "output", "logs", ... } }`

## Schemas

| 方法 | 路径 |
|------|------|
| GET  | `/api/v1/apps/[appId]/schemas` |
| POST | `/api/v1/apps/[appId]/schemas` |
| GET  | `/api/v1/apps/[appId]/schemas/[dataType]` |
| PUT  | `/api/v1/apps/[appId]/schemas/[dataType]/activate` |

## 错误码

前缀清单：`AUTH_*` / `APP_*` / `DATA_*` / `SCHEMA_*` / `POLICY_*` / `FILE_*` / `FUNC_*` / `CRON_*` / `HOOK_*` / `QUOTA_*` / `RATE_LIMITED` / `VALIDATION_FAILED` / `CORS_*` / `INTERNAL_ERROR`。

完整清单见 `src/shared/errors/codes.ts`。
