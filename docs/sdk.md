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

const doc = policy.withFields({
  "likes": { read: ["$public"], create: ["$dynamic:likes.$user"] }
});
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
