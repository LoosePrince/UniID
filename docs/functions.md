# Edge Functions

> 通过 QuickJS (WASM) 在 Next.js 进程内运行用户脚本，**强限额 + 强沙箱**。

## 触发方式

| Trigger | 说明 |
|---------|------|
| `sdk`   | `uniid.functions.invoke("fnName", payload)` |
| `http`  | `POST /api/v1/functions/[fnId]/invoke`（同上） |
| `cron`  | 通过 `CronJob` 调度 |
| `event` | `bus.on("record.created" \| "file.uploaded" \| ...)` → invoke |

## 函数模板

```js
export default async function handler(event) {
  // event = { payload, ctx: { userId, appId }, log, env }
  uniid.log("hello", event.payload);

  const res = await uniid.fetch("https://api.example.com/data");
  const json = await res.json();

  return { ok: true, items: json.items.length };
}
```

## Host API（注入到沙箱）

- `uniid.log(...args)` — 记录到 `FunctionInvocation.logs`
- `uniid.fetch(url, init?)` — 受 `FN_FETCH_WHITELIST` 限制；默认 5s 超时
- `uniid.data.*` / `uniid.files.*`（未来）— 走 PolicyEngine，以 `$function:{name}` 身份

## 限额

| 资源 | 默认 | 可配置 |
|------|------|--------|
| 内存 | 64 MB | per-function `memoryMb` |
| 时长 | 5000 ms | per-function `timeoutMs` |
| `fetch` 域名 | 空（全禁） | `FN_FETCH_WHITELIST=api.example.com,...` |

超出 → `FUNC_TIMEOUT` / `FUNC_OOM` 错误码。

## 部署

1. 在控制台 `/console/apps/[appId]/functions` 新建函数（Monaco 编辑器）
2. 保存 → 后端 `FunctionDeployment` 自动版本 +1
3. 切换 active version（默认部署后自动设为 active）
4. 实时日志：控制台日志面板订阅 `FunctionInvocation` SSE 流

## 安全清单

- 禁止访问 `process` / `fs` / 原生 `fetch` / `eval` / `Function`
- 所有 host call 通过 `marshalToHost` 序列化（避免泄漏 QuickJS 句柄）
- `fetch` 强制走域名白名单；缺省全禁
- 超时硬 kill；OOM 直接抛出
- 输出 / 日志 / payload 都做 16KB 截断后再入库
