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
    adminIds TEXT,                             -- 应用管理员ID列表(JSON数组)
    FOREIGN KEY (ownerId) REFERENCES users(id)
);

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
    permissions TEXT NOT NULL,                 -- 权限配置(JSON字符串)
    createdAt INTEGER NOT NULL,                -- 创建时间
    updatedAt INTEGER NOT NULL,                -- 更新时间
    createdById TEXT,                          -- 创建者ID
    updatedById TEXT,                          -- 更新者ID
    deleted INTEGER DEFAULT 0,                 -- 软删除
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
GET /api/data/record/{record_id}
Headers:
    Authorization: Bearer {token}
Query Params:
    fields: "field1,field2"   // 指定字段(可选)
Response: 记录对象

// 更新记录(部分更新)
PATCH /api/data/record/{record_id}
Headers:
    Authorization: Bearer {token}
Request:
{
    "data": {...},           // 要更新的字段
    "permissions": {...}      // 要更新的权限
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
        });
    }

    // 登录
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
        requireAuth = requireAuth !== false; // 默认需要认证
        if (requireAuth) {
            if (!this.token) {
                this._restoreTokenFromCookie();
            }
            if (!this.token) {
                return Promise.reject(new Error("NO_TOKEN"));
            }
        }
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

### 6.2 使用示例

```html
<!-- 网站中引入 SDK -->
<script src="https://auth.example.com/sdk/uniid.sdk.js"></script>

<!-- 在页面中放置挂载点 -->
<div id="auth-iframe-mount"></div>

<script>
const auth = new AuthSDK({
    authServer: 'https://auth.example.com',
    appId: 'my-blog-site',
    mountId: 'auth-iframe-mount'  // 必需：iframe 挂载点元素 ID
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

// 撤销授权/登出
async function handleLogout() {
    await auth.logout();
}
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
