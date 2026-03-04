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

### 1.3 技术选型

前端框架：Next.js 14+ (App Router)
UI 框架：React 18+
语言：TypeScript 5+
数据库：SQLite (better-sqlite3) + Prisma ORM
认证：NextAuth.js / Auth.js
API：Next.js Route Handlers + tRPC
实时通信：WebSocket (ws) / Server-Sent Events

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

### 3.1 核心表结构

```sql
-- 用户表
CREATE TABLE users (
    id TEXT PRIMARY KEY,                    -- 用户ID (UUID)
    username TEXT UNIQUE NOT NULL,           -- 用户名
    password_hash TEXT NOT NULL,              -- 密码哈希
    email TEXT UNIQUE,                        -- 邮箱
    role TEXT DEFAULT 'user',                  -- 角色: admin/user
    created_at INTEGER NOT NULL,               -- 创建时间戳
    updated_at INTEGER NOT NULL,                -- 更新时间戳
    settings JSON,                              -- 用户设置(JSON)
    deleted INTEGER DEFAULT 0                    -- 软删除标记
);

-- 会话表
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,                       -- 会话ID
    user_id TEXT NOT NULL,                      -- 用户ID
    token TEXT UNIQUE NOT NULL,                  -- 访问令牌
    refresh_token TEXT UNIQUE,                    -- 刷新令牌
    expires_at INTEGER NOT NULL,                   -- 过期时间
    created_at INTEGER NOT NULL,                    -- 创建时间
    last_activity INTEGER,                           -- 最后活动时间
    user_agent TEXT,                                  -- 用户代理
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 应用(网站)表
CREATE TABLE apps (
    id TEXT PRIMARY KEY,                          -- 应用ID
    name TEXT NOT NULL,                             -- 应用名称
    domain TEXT UNIQUE NOT NULL,                     -- 应用域名
    description TEXT,                                  -- 应用描述
    created_at INTEGER NOT NULL,                        -- 创建时间
    owner_id TEXT NOT NULL,                              -- 创建者ID
    status TEXT DEFAULT 'active',                         -- 状态
    api_key TEXT UNIQUE,                                   -- API密钥
    settings JSON,                                          -- 应用设置
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- 授权表
CREATE TABLE authorizations (
    id TEXT PRIMARY KEY,                              -- 授权ID
    user_id TEXT NOT NULL,                              -- 用户ID
    app_id TEXT NOT NULL,                                -- 应用ID
    auth_type TEXT NOT NULL,                              -- 授权类型: full/restricted
    granted_at INTEGER NOT NULL,                           -- 授权时间
    expires_at INTEGER,                                      -- 过期时间(空表示永久)
    revoked INTEGER DEFAULT 0,                               -- 是否撤销
    permissions JSON,                                        -- 额外权限配置
    UNIQUE(user_id, app_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (app_id) REFERENCES apps(id)
);

-- 数据记录表 (核心灵活存储)
CREATE TABLE records (
    id TEXT PRIMARY KEY,                              -- 记录ID
    app_id TEXT NOT NULL,                               -- 所属应用
    owner_id TEXT,                                       -- 所有者ID(空表示应用级数据)
    data_type TEXT NOT NULL,                             -- 数据类型(如: post, form)
    data JSON NOT NULL,                                   -- 实际数据(JSON格式)
    permissions JSON NOT NULL,                             -- 权限配置
    created_at INTEGER NOT NULL,                           -- 创建时间
    updated_at INTEGER NOT NULL,                            -- 更新时间
    created_by TEXT,                                         -- 创建者ID
    updated_by TEXT,                                         -- 更新者ID
    deleted INTEGER DEFAULT 0,                               -- 软删除
    FOREIGN KEY (app_id) REFERENCES apps(id),
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

```

### 3.2 权限数据结构

```sql
-- records表的permissions字段JSON结构示例
{
    "default": {
        "read": ["$owner", "$app_admin"],           -- 默认读权限
        "write": ["$owner"],                          -- 默认写权限
        "delete": ["$owner"]                           -- 默认删权限
    },
    "fields": {
        "data.title": {
            "read": ["$all"],                           -- 所有人可读
            "write": ["$owner", "user:123"]              -- 所有者和指定用户可写
        },
        "data.content": {
            "read": ["$all"],   
            "write": ["$owner", "$user:456"]  
        },
        "data.metadata.comments": {
            "read": ["$all"],
            "write": ["$dynamic:comments.$user"],        -- 动态路径权限
            "delete": ["$owner"]
        }
    }
}

-- 动态变量说明
-- $owner: 记录所有者
-- $all: 所有已认证用户
-- $public: 所有人(包括未认证)
-- $app: 应用自身
-- $user:{id}: 指定用户
-- $role:{role}: 指定角色
-- $dynamic:{path}: 动态路径，{path}中的$user会被替换为当前用户ID
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
   - 显示申请授权的网站信息
   - 提供授权类型选择(完整/限制)
4. 用户确认授权 -> 生成授权记录和token
5. token通过postMessage返回给网站
6. 网站保存token，后续API调用携带token
```

## 五、API设计

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

POST /api/auth/logout
Headers:
    Authorization: Bearer {token}

GET /api/auth/check
Headers:
    Authorization: Bearer {token}
Response:
{
    "valid": true,
    "user": {...},
    "app_id": "string",
    "auth_type": "full/restricted"
}
```

### 5.2 数据操作API

```
// 创建记录
POST /api/data/{app_id}/{data_type}
Headers:
    Authorization: Bearer {token}
Request:
{
    "data": {...},           // 任意JSON数据
    "permissions": {...}      // 权限配置(可选)
}
Response:
{
    "id": "string",
    "created_at": 1234567890,
    "data": {...},
    "permissions": {...}
}

// 读取记录
GET /api/data/{record_id}
Headers:
    Authorization: Bearer {token}
Query Params:
    fields: "field1,field2"   // 指定字段(可选)
Response: 记录对象

// 更新记录(部分更新)
PATCH /api/data/{record_id}
Headers:
    Authorization: Bearer {token}
Request:
{
    "data": {...},           // 要更新的字段
    "permissions": {...}      // 要更新的权限
}
Response: 更新后的记录

// 删除记录
DELETE /api/data/{record_id}
Headers:
    Authorization: Bearer {token}

// 删除字段
DELETE /api/data/{record_id}/fields/{field_path}
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

### 5.3 权限管理API

```
// 获取用户对自己数据的权限
GET /api/permissions/{record_id}
Headers:
    Authorization: Bearer {token}
Response:
{
    "record_id": "string",
    "overall": 3,              // 整体权限级别
    "fields": {
        "data.title": 2,
        "data.content": 1
    }
}

// 检查特定字段权限
GET /api/permissions/check
Headers:
    Authorization: Bearer {token}
Query Params:
    record_id: "string",
    field_path: "string",
    operation: "read/write/delete"
Response:
{
    "allowed": true/false,
    "reason": "string"
}
```

## 六、客户端SDK设计

### 6.1 SDK初始化

```javascript
// auth.js
class AuthSDK {
    constructor(config) {
        this.authServer = config.authServer;
        this.appId = config.appId;
        this.token = localStorage.getItem('auth_token');
        this.iframe = null;
        this.init();
    }
    
    init() {
        // 创建隐藏iframe
        this.iframe = document.createElement('iframe');
        this.iframe.src = `${this.authServer}/embed?app_id=${this.appId}`;
        this.iframe.style.display = 'none';
        document.body.appendChild(this.iframe);
        
        // 监听消息
        window.addEventListener('message', this.handleMessage.bind(this));
    }
    
    // 登录
    login() {
        return new Promise((resolve) => {
            this.showAuthModal();  // 显示登录授权弹窗
            this.loginResolver = resolve;
        });
    }
    
    // 数据操作
    async create(type, data, permissions = null) {
        return this.apiCall('POST', `/api/data/${this.appId}/${type}`, {
            data, permissions
        });
    }
    
    async read(recordId, fields = null) {
        const url = fields 
            ? `/api/data/${recordId}?fields=${fields.join(',')}`
            : `/api/data/${recordId}`;
        return this.apiCall('GET', url);
    }
    
    async update(recordId, data, permissions = null) {
        return this.apiCall('PATCH', `/api/data/${recordId}`, {
            data, permissions
        });
    }
    
    async delete(recordId) {
        return this.apiCall('DELETE', `/api/data/${recordId}`);
    }
    
    async deleteField(recordId, fieldPath) {
        return this.apiCall('DELETE', `/api/data/${recordId}/fields/${fieldPath}`);
    }
    
    async query(queryParams) {
        return this.apiCall('POST', '/api/data/query', queryParams);
    }
    
    // 权限检查
    async checkPermission(recordId, fieldPath, operation) {
        return this.apiCall('GET', 
            `/api/permissions/check?record_id=${recordId}&field_path=${fieldPath}&operation=${operation}`
        );
    }
}
```

### 6.2 使用示例

```javascript
// 网站中引入SDK
<script src="https://auth.example.com/sdk/auth.js"></script>

<script>
const auth = new AuthSDK({
    authServer: 'https://auth.example.com',
    appId: 'my-blog-site'
});

// 检查登录状态
if (!auth.isLoggedIn()) {
    await auth.login();
}

// 创建帖子
const post = await auth.create('post', {
    title: 'Hello World',
    content: 'This is my first post',
    metadata: {
        tags: ['test'],
        comments: {}
    }
}, {
    fields: {
        'data.title': {
            read: ['$all'],
            write: ['$owner']
        },
        'data.metadata.comments': {
            read: ['$all'],
            write: ['$dynamic:comments.$user']
        }
    }
});

// 用户评论
await auth.update(post.id, {
    metadata: {
        comments: {
            [userId]: 'Great post!'
        }
    }
});

// 查询帖子
const posts = await auth.query({
    data_type: 'post',
    filter: {
        'data.metadata.tags': 'test'
    },
    sort: {created_at: 'desc'},
    limit: 10
});
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

## 八、Demo 示例站点

### 8.1 访问方式

- 在开发环境启动 Next.js 服务后，可直接访问：
  - `http://localhost:3000/demo`
- 该页面是一个纯静态的示例博客站点，通过 `<script src="/sdk/auth.js"></script>` 引入浏览器版 SDK，并调用统一认证服务完成登录与发帖。

### 8.2 示例流程

- 初始化 SDK（在 `public/demo/index.html` 中）：

```html
<script src="/sdk/auth.js"></script>
<script>
  const auth = new window.AuthSDK({
    authServer: window.location.origin,
    appId: "demo-blog"
  });
</script>
```

- 登录 / 授权：
  - 点击页面右上角“登录 / 授权”按钮。
  - SDK 会通过隐藏 iframe 打开 UniID 的登录与授权流程，并在授权完成后通过 `postMessage` 返回 token 与用户信息。
  - Demo 页面根据返回的 `user` 更新登录状态显示。

- 发表帖子：
  - 在“发表新帖子”表单中填写标题与内容，点击“发布帖子”。
  - Demo 会调用：

```js
await auth.create("post", data, permissions);
```

  - 后端将数据写入 `records` 表，并返回记录 ID 与权限配置；Demo 会在页面右侧列表中展示本次会话创建的帖子。

### 8.3 与 CORS / 应用白名单的关系

- Demo 默认与 UniID 服务同域部署（如 `http://localhost:3000/demo`），请求的 `Origin` 为当前站点地址。
- 数据 API `/api/data/*` 仍受 CORS 白名单控制：
  - 通过 `apps` 表中的 `domain` 字段判断是否允许该 Origin。
  - 推荐在 `apps` 表中创建一个应用：
    - `id`: `demo-blog`
    - `domain`: `localhost:3000`（或实际部署域名）
- 示例站点只是一个使用 SDK 的参考实现，真实外部网站可以拷贝 `public/demo/index.html` 的结构，并将 `authServer` 与 `appId` 替换为自己的配置。

