# UniID 静态站点 Demo

在 **5500** 端口提供纯 HTML 演示页，对接本地 **3000** 端口的 UniID API。

## 前置条件

1. 已执行 `npm install`、`prisma migrate`、`npm run prisma:seed`
2. 终端 A：`npm run dev`（API + 控制台 + `/embed`）
3. 终端 B：`npm run demo`（构建 SDK、复制 UMD、启动静态服务）

## 演示账号

| 用户 | 密码 | 说明 |
|------|------|------|
| `alice` | `password` | 发文章 |
| `bob` | `password` | 备用 |
| `admin` | `admin12345` | 需在 http://localhost:3000/login 先登录一次，embed 授权才可用 |

Demo 应用 ID：`app_demo_blog`，注册域名：`localhost:5500` / `127.0.0.1:5500`。

## 页面

| 文件 | 说明 |
|------|------|
| [index.html](index.html) | 主博客 demo（Auth + Data + Realtime） |
| [react-demo.html](react-demo.html) | React 18 UMD 示例 |
| [vue-demo.html](vue-demo.html) | Vue 3 UMD 示例 |

## SDK 引用

```html
<script src="./config.js"></script>
<script src="./sdk/uniid.umd.js"></script>
<script>
  const uniid = createUniID();
  await uniid.auth.login({ parentOrigin: window.location.origin });
</script>
```

`./sdk/uniid.umd.js` 由 `npm run demo:prepare` 从 `packages/sdk-core/dist` 复制生成，勿手改。

## 覆盖 API 地址

```
http://localhost:5500/?api=http://127.0.0.1:3000&appId=app_demo_blog
```

## 若 seed 早于固定 appId

若数据库里演示应用的 ID 不是 `app_demo_blog`，请重新 seed：

```powershell
npm run prisma:seed
```

或在控制台查看应用 ID，通过 `?appId=...` 传入。
