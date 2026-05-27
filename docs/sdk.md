# UniID SDK

## 安装

```bash
npm i @uniid/sdk
# 框架适配
npm i @uniid/sdk-react   # React 18+
npm i @uniid/sdk-vue     # Vue 3.3+
```

CDN：`<script src="https://your-uniid.com/sdk/uniid.umd.js"></script>` 暴露全局 `UniID`。

## 初始化

```ts
import { UniID } from "@uniid/sdk";

const uniid = new UniID({
  url: "https://uniid.example.com",
  appId: "app_xxx",
  mount: "#uniid-mount", // 可选；不传则自动覆盖在 body
  theme: "auto",          // light | dark | auto
  autoRefresh: true       // 自动刷新 access token
});
```

## Auth

```ts
await uniid.auth.login({ authType: "restricted", scope: { fields: ["profile.name"] } });
uniid.auth.user;             // UniIDUser | null
uniid.auth.onChange((u) => console.log(u));
await uniid.auth.refresh();
await uniid.auth.logout();
```

## Data

```ts
const posts = await uniid
  .from("post")
  .select(["id", "data.title"])
  .where({ "data.status": "published" })
  .orderBy({ createdAt: "desc" })
  .limit(20)
  .run();

const created = await uniid.from("post").insert({ title: "Hi" });
await uniid.from("post").update(created.id, { title: "Updated" });
await uniid.from("post").ops(created.id, [{ type: "increment", path: "data.likes", value: 1 }]);
await uniid.from("post").delete(created.id);
```

## Business actions / Workflow

业务状态流转走 `transition()` 或 `action()`，请求体会进入后端统一 Command，并由 Policy、Mutation Rule、Workflow 和最终 Schema 校验共同处理。

```ts
await uniid.from("article").transition(created.id, "submit", {
  data: { status: "reviewing" },
  metadata: { source: "editor" }
});

await uniid.from("article").action(created.id, "publish", {
  data: { publishedAt: Math.floor(Date.now() / 1000) }
});
```

`metadata` 只进入业务上下文，不会直接写入记录。`merge` 默认由服务端按 `true` 处理，需要替换语义时可显式传入 `merge: false`。

```ts
await uniid.from("order").transition(order.id, "ship", {
  data: { status: "shipped", shippedAt: Math.floor(Date.now() / 1000) },
  merge: true
});
```

## Files

```ts
const file = await uniid.files.upload(blob, { visibility: "public" });
const url  = await uniid.files.getDownloadUrl(file.id);
const share = await uniid.files.share(file.id, { expiresIn: 3600 });
```

## Realtime

```ts
const ch = uniid.realtime.channel("records:post");
ch.on("insert", (rec) => console.log(rec));
ch.on("update", (rec) => console.log(rec));
await ch.subscribe();
```

## Functions

```ts
const result = await uniid.functions.invoke<{ ok: boolean }>("myFn", { name: "world" });
```

## Policy

```ts
import { policy } from "@uniid/sdk";

const doc = policy.document([
  policy.rule({ id: "public-read-likes", actions: "read", subjects: "$public", fields: "data.likes" }),
  policy.dynamicOwnerKey({ field: "data.likes.*", path: "likes.$user", actions: ["set", "unset", "push"] })
]);
```

## React

```tsx
import { UniIDProvider, useUniID, useQuery, useSubscription } from "@uniid/sdk-react";

<UniIDProvider client={uniid}>
  <App />
</UniIDProvider>

function App() {
  const { user, login, logout } = useUniID();
  const { data: posts } = useQuery(() => uniid.from("post").limit(10), []);
  const { events } = useSubscription(() => uniid.realtime.channel("records:post"));
  /* ... */
}
```

## Vue 3

```ts
import { createApp } from "vue";
import { provideUniID, useUniID, useUniIDQuery } from "@uniid/sdk-vue";

const app = createApp(App);
provideUniID(app, uniid);
app.mount("#app");

// inside setup
const { user, login } = useUniID();
const { data } = useUniIDQuery(() => uniid.from("post").limit(10));
```
