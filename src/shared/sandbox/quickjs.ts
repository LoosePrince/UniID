/**
 * QuickJS sandbox runner（基于 quickjs-emscripten）。
 *
 * 设计目标：
 *   - 每次执行新建 context（隔离）
 *   - 通过 deadline + memory 控制资源
 *   - 给沙箱注入 uniid.{db, fetch, log, broadcast} 等宿主能力（实现时按需开关）
 *   - 异步运行：用 evalCode 拿到 Promise → 在 host runtime 中 resolve
 *
 * 第一版仅同步代码 + console.log + uniid.fetch（受白名单约束）
 */

import { getQuickJS, type QuickJSContext } from "quickjs-emscripten";
import { config } from "@/shared/config";

export interface SandboxOptions {
  /** ms */
  timeoutMs?: number;
  memoryMb?: number;
  /** 主入口源码（应导出 default async (input, uniid) => any） */
  source: string;
  /** 调用入参 */
  input: unknown;
  /** 沙箱环境变量 */
  env?: Record<string, string>;
  /** 标识当前函数名（写入审计） */
  functionName?: string;
}

export interface SandboxResult {
  status: "ok" | "error" | "timeout" | "oom";
  output?: unknown;
  logs: string[];
  error?: string;
  durationMs: number;
  memoryPeakKb?: number;
}

const TRUNCATE = 16 * 1024;

function fetchAllowed(targetUrl: string): boolean {
  const list = config().fetchWhitelistHosts;
  if (list.length === 0) return false;
  try {
    const u = new URL(targetUrl);
    return list.includes(u.host);
  } catch {
    return false;
  }
}

export async function runSandbox(opts: SandboxOptions): Promise<SandboxResult> {
  const start = Date.now();
  const logs: string[] = [];
  const timeoutMs = opts.timeoutMs ?? config().FN_DEFAULT_TIMEOUT_MS;
  const memoryMb = opts.memoryMb ?? config().FN_DEFAULT_MEMORY_MB;

  let QuickJS;
  try {
    QuickJS = await getQuickJS();
  } catch (err) {
    return {
      status: "error",
      logs,
      error: `quickjs unavailable: ${String(err)}`,
      durationMs: Date.now() - start
    };
  }

  const runtime = QuickJS.newRuntime();
  runtime.setMemoryLimit(memoryMb * 1024 * 1024);
  runtime.setMaxStackSize(1024 * 1024); // 1MB stack
  const deadline = Date.now() + timeoutMs;
  runtime.setInterruptHandler(() => Date.now() > deadline);

  const ctx = runtime.newContext();
  try {
    // host: console.log
    const consoleObj = ctx.newObject();
    const logFn = ctx.newFunction("log", (...args) => {
      const parts = args.map((a) => {
        try {
          return JSON.stringify(ctx.dump(a));
        } catch {
          return String(ctx.getString(a));
        }
      });
      logs.push(parts.join(" "));
      args.forEach((a) => a.dispose());
    });
    ctx.setProp(consoleObj, "log", logFn);
    ctx.setProp(ctx.global, "console", consoleObj);
    consoleObj.dispose();
    logFn.dispose();

    // host: uniid.* (最小实现)
    const uniidObj = ctx.newObject();

    // uniid.input
    const inputJson = JSON.stringify(opts.input ?? null);
    ctx.evalCode(`globalThis.__uniid_input__ = ${inputJson || "null"};`);

    // uniid.fetch — 返回 Promise，宿主侧异步完成后 resolve。
    // 限制：仅 GET/POST/PUT/DELETE，白名单域名，5s 超时，响应 256KB 截断。
    const fetchFn = ctx.newFunction("fetch", (urlH, optsH) => {
      const url = ctx.getString(urlH);
      urlH.dispose();
      let init: { method?: string; body?: string; headers?: Record<string, string> } = {};
      if (optsH) {
        try {
          const dumped = ctx.dump(optsH);
          if (dumped && typeof dumped === "object") init = dumped as typeof init;
        } catch {}
        optsH.dispose();
      }
      if (!fetchAllowed(url)) {
        return { error: ctx.newError("uniid.fetch: host not whitelisted") };
      }

      const promise = ctx.newPromise();
      const method = (init.method ?? "GET").toUpperCase();
      if (!["GET", "POST", "PUT", "DELETE", "PATCH"].includes(method)) {
        promise.reject(ctx.newError("uniid.fetch: invalid method"));
        promise.dispose();
        return promise.handle;
      }

      void (async () => {
        try {
          const ctrl = new AbortController();
          const tid = setTimeout(() => ctrl.abort(), 5_000);
          const res = await fetch(url, {
            method,
            headers: init.headers,
            body: method === "GET" || method === "DELETE" ? undefined : init.body,
            signal: ctrl.signal
          });
          clearTimeout(tid);
          const text = await res.text();
          const truncated = text.length > 256 * 1024 ? text.slice(0, 256 * 1024) : text;
          const obj = ctx.newObject();
          const statusH = ctx.newNumber(res.status);
          const okH = res.ok ? ctx.true : ctx.false;
          const textH = ctx.newString(truncated);
          ctx.setProp(obj, "status", statusH);
          ctx.setProp(obj, "ok", okH);
          ctx.setProp(obj, "text", textH);
          statusH.dispose();
          textH.dispose();
          promise.resolve(obj);
          obj.dispose();
        } catch (err) {
          const errH = ctx.newError(String((err as Error)?.message ?? err));
          promise.reject(errH);
          errH.dispose();
        } finally {
          promise.dispose();
          // 推动 QuickJS 事件循环执行 pending jobs
          try { runtime.executePendingJobs(); } catch {}
        }
      })();

      return promise.handle;
    });
    ctx.setProp(uniidObj, "fetch", fetchFn);
    fetchFn.dispose();

    // uniid.env
    if (opts.env) {
      const envObj = ctx.newObject();
      for (const [k, v] of Object.entries(opts.env)) {
        const sh = ctx.newString(String(v));
        ctx.setProp(envObj, k, sh);
        sh.dispose();
      }
      ctx.setProp(uniidObj, "env", envObj);
      envObj.dispose();
    }

    ctx.setProp(ctx.global, "uniid", uniidObj);
    uniidObj.dispose();

    const wrapper = `
      (async () => {
        ${opts.source}
        if (typeof handler !== "function") {
          throw new Error("function must define a top-level 'handler(input, uniid)'");
        }
        return await handler(globalThis.__uniid_input__, uniid);
      })()
    `;

    const result = ctx.evalCode(wrapper);
    if (result.error) {
      const err = ctx.dump(result.error);
      result.error.dispose();
      return {
        status: "error",
        logs,
        error: typeof err === "string" ? err : JSON.stringify(err),
        durationMs: Date.now() - start
      };
    }

    // Promise resolution
    const handle = result.value;
    const resolved = await ctx.resolvePromise(handle);
    handle.dispose();
    if (resolved.error) {
      const err = ctx.dump(resolved.error);
      resolved.error.dispose();
      return {
        status: "error",
        logs,
        error: typeof err === "string" ? err : JSON.stringify(err),
        durationMs: Date.now() - start
      };
    }
    const output = ctx.dump(resolved.value);
    resolved.value.dispose();
    return {
      status: "ok",
      output: truncate(output),
      logs: logs.slice(0, 200),
      durationMs: Date.now() - start
    };
  } catch (err) {
    const msg = String(err);
    if (/interrupt/i.test(msg)) {
      return { status: "timeout", logs, error: "timeout", durationMs: Date.now() - start };
    }
    if (/out of memory/i.test(msg)) {
      return { status: "oom", logs, error: "oom", durationMs: Date.now() - start };
    }
    return { status: "error", logs, error: msg, durationMs: Date.now() - start };
  } finally {
    try {
      ctx.dispose();
    } catch {}
    try {
      runtime.dispose();
    } catch {}
  }
}

function truncate(v: unknown): unknown {
  try {
    const s = JSON.stringify(v);
    if (s.length <= TRUNCATE) return v;
    return { _truncated: true, preview: s.slice(0, TRUNCATE) };
  } catch {
    return null;
  }
}
