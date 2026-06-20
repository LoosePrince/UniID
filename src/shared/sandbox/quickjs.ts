/**
 * QuickJS sandbox runner（基于 quickjs-emscripten）。
 *
 * 设计目标：
 *   - 每次执行新建 context（隔离）
 *   - 通过 deadline + memory 控制资源
 *   - 给沙箱注入 uniid.{db, fetch, log, broadcast} 等宿主能力（实现时按需开关）
 *   - 异步运行：用 evalCode 拿到 Promise → 在 host runtime 中 resolve
 *
 * 宿主能力按 app 上下文受限开放：
 *   - uniid.log(...)
 *   - uniid.fetch(url, init)
 *   - uniid.data.{query,get,create,update,delete,fieldOps}
 *   - uniid.files.{getDownloadUrl,share,getActiveShareToken,revokeShareTokens}
 *   - uniid.broadcast(channel, payload, event?)
 */

import { getQuickJS, type QuickJSHandle } from "quickjs-emscripten";
import { config } from "@/shared/config";
import type { AuthContext } from "@/shared/policy";

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
  /** 业务函数所属 app；schema validationRules 等轻量沙箱可不传 */
  appId?: string;
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
const FETCH_TEXT_LIMIT = 256 * 1024;

type JsonObject = Record<string, unknown>;

interface FetchInitDump {
  method?: string;
  body?: string;
  headers?: Record<string, string>;
}

interface DataCall {
  dataType?: string;
  recordId?: string;
  where?: Record<string, unknown>;
  select?: string[];
  orderBy?: Record<string, "asc" | "desc">;
  limit?: number;
  cursor?: string;
  data?: unknown;
  ownerId?: string | null;
  merge?: boolean;
  ops?: unknown[];
}

interface FileCall {
  fileId?: string;
  ttlSeconds?: number;
}

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

function stringifyLogValue(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function jsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object") {
    const out: JsonObject = {};
    for (const [key, item] of Object.entries(value as JsonObject)) out[key] = jsonSafe(item);
    return out;
  }
  return value;
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

function functionActor(appId: string, functionName?: string): AuthContext {
  return {
    userId: null,
    role: null,
    systemAdmin: false,
    appAdmin: false,
    appId,
    authType: "full",
    ownerId: null,
    origin: "function",
    functionName
  };
}

async function assertFileInApp(appId: string, fileId: string) {
  const { prisma } = await import("@/shared/prisma");
  const file = await prisma.fileObject.findUnique({
    where: { id: fileId },
    select: { id: true, appId: true, deletedAt: true }
  });
  if (!file || file.deletedAt || file.appId !== appId) {
    throw new Error("uniid.files: file not found in current app");
  }
}

async function appOwnerId(appId: string): Promise<string> {
  const { prisma } = await import("@/shared/prisma");
  const app = await prisma.app.findUnique({ where: { id: appId }, select: { ownerId: true } });
  if (!app) throw new Error("uniid.files: app not found");
  return app.ownerId;
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
    const toVm = (value: unknown): QuickJSHandle => {
      const json = JSON.stringify(jsonSafe(value));
      const result = ctx.evalCode(json === undefined ? "undefined" : `(${json})`);
      if (result.error) {
        const dumped = ctx.dump(result.error);
        result.error.dispose();
        throw new Error(typeof dumped === "string" ? dumped : JSON.stringify(dumped));
      }
      return result.value;
    };

    const hostFunction = (
      name: string,
      fn: (...args: unknown[]) => Promise<unknown> | unknown
    ): QuickJSHandle =>
      ctx.newFunction(name, (...args) => {
        const values = args.map((arg) => ctx.dump(arg));
        const promise = ctx.newPromise();

        void Promise.resolve()
          .then(() => fn(...values))
          .then((value) => {
            const handle = toVm(value);
            promise.resolve(handle);
            handle.dispose();
          })
          .catch((err) => {
            const errorHandle = ctx.newError(String((err as Error)?.message ?? err));
            promise.reject(errorHandle);
            errorHandle.dispose();
          })
          .finally(() => {
            try {
              runtime.executePendingJobs();
            } catch {}
            promise.dispose();
          });

        return promise.handle;
      });

    const requireAppId = (apiName: string) => {
      if (!opts.appId) throw new Error(`${apiName}: app context required`);
      return opts.appId;
    };

    const normalizeQuery = (first: unknown, second?: unknown) => {
      const raw = typeof first === "string"
        ? { ...asObject(second), dataType: first }
        : asObject(first);
      const input = raw as DataCall;
      const orderBy: Record<string, "asc" | "desc"> = {};
      for (const [key, value] of Object.entries(asObject(input.orderBy))) {
        if (value === "asc" || value === "desc") orderBy[key] = value;
      }
      return {
        dataType: requireString(input.dataType, "uniid.data.query.dataType"),
        dsl: {
          where: asObject(input.where),
          select: Array.isArray(input.select) ? input.select.filter((item): item is string => typeof item === "string") : undefined,
          orderBy: Object.keys(orderBy).length > 0 ? orderBy : undefined,
          limit: typeof input.limit === "number" ? input.limit : undefined,
          cursor: typeof input.cursor === "string" ? input.cursor : undefined
        }
      };
    };

    const normalizeRecordCall = (apiName: string, first: unknown, second?: unknown) => {
      const raw = typeof first === "string"
        ? { dataType: first, recordId: second }
        : asObject(first);
      return {
        dataType: requireString((raw as DataCall).dataType, `${apiName}.dataType`),
        recordId: requireString((raw as DataCall).recordId, `${apiName}.recordId`)
      };
    };

    const normalizeFileId = (apiName: string, first: unknown): string => {
      if (typeof first === "string") return requireString(first, `${apiName}.fileId`);
      return requireString((asObject(first) as FileCall).fileId, `${apiName}.fileId`);
    };

    const normalizeHeaders = (value: unknown): Record<string, string> | undefined => {
      const headers = asObject(value);
      const normalized = Object.entries(headers).reduce<Record<string, string>>((acc, [key, item]) => {
        if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
          acc[key] = String(item);
        }
        return acc;
      }, {});
      return Object.keys(normalized).length > 0 ? normalized : undefined;
    };

    // host: console.log / uniid.log
    const consoleObj = ctx.newObject();
    const logFn = ctx.newFunction("log", (...args) => {
      const parts = args.map((arg) => {
        try {
          return stringifyLogValue(ctx.dump(arg));
        } catch {
          return String(ctx.getString(arg));
        }
      });
      logs.push(parts.join(" "));
    });
    ctx.setProp(consoleObj, "log", logFn);
    ctx.setProp(ctx.global, "console", consoleObj);
    consoleObj.dispose();

    const uniidObj = ctx.newObject();
    ctx.setProp(uniidObj, "log", logFn);
    logFn.dispose();

    // uniid.input
    const inputJson = JSON.stringify(opts.input ?? null);
    const inputResult = ctx.evalCode(`globalThis.__uniid_input__ = ${inputJson || "null"};`);
    if (inputResult.error) {
      inputResult.error.dispose();
    } else {
      inputResult.value.dispose();
    }

    const fetchRawFn = hostFunction("__fetchRaw", async (urlArg, initArg) => {
      const url = requireString(urlArg, "uniid.fetch.url");
      const init = asObject(initArg) as FetchInitDump;
      if (!fetchAllowed(url)) throw new Error("uniid.fetch: host not whitelisted");

      const method = (init.method ?? "GET").toUpperCase();
      if (!["GET", "POST", "PUT", "DELETE", "PATCH"].includes(method)) {
        throw new Error("uniid.fetch: invalid method");
      }

      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 5_000);
      try {
        const rawBody = (init as JsonObject).body;
        const res = await fetch(url, {
          method,
          headers: normalizeHeaders(init.headers),
          body: method === "GET" || method === "DELETE"
            ? undefined
            : typeof rawBody === "string"
              ? rawBody
              : rawBody == null
                ? undefined
                : JSON.stringify(rawBody),
          signal: ctrl.signal
        });
        const text = await res.text();
        const bytes = Buffer.byteLength(text, "utf8");
        if (opts.appId && bytes > 0) {
          const { QuotaService } = await import("@/shared/quota");
          await QuotaService.consume(opts.appId, "egressBytes", bytes);
        }
        const headers: Record<string, string> = {};
        res.headers.forEach((value, key) => {
          headers[key] = value;
        });
        return {
          status: res.status,
          ok: res.ok,
          headers,
          text: text.length > FETCH_TEXT_LIMIT ? text.slice(0, FETCH_TEXT_LIMIT) : text,
          truncated: text.length > FETCH_TEXT_LIMIT,
          bytes
        };
      } finally {
        clearTimeout(tid);
      }
    });
    ctx.setProp(uniidObj, "__fetchRaw", fetchRawFn);
    fetchRawFn.dispose();

    const dataQueryFn = hostFunction("__dataQuery", async (first, second) => {
      const appId = requireAppId("uniid.data.query");
      const { DataService } = await import("@/modules/data");
      const { dataType, dsl } = normalizeQuery(first, second);
      return DataService.query({ appId, dataType, dsl, actor: functionActor(appId, opts.functionName) });
    });
    ctx.setProp(uniidObj, "__dataQuery", dataQueryFn);
    dataQueryFn.dispose();

    const dataGetFn = hostFunction("__dataGet", async (first, second) => {
      const appId = requireAppId("uniid.data.get");
      const { DataService } = await import("@/modules/data");
      const { dataType, recordId } = normalizeRecordCall("uniid.data.get", first, second);
      return DataService.getById({ appId, dataType, recordId, actor: functionActor(appId, opts.functionName) });
    });
    ctx.setProp(uniidObj, "__dataGet", dataGetFn);
    dataGetFn.dispose();

    const dataCreateFn = hostFunction("__dataCreate", async (first, second, third) => {
      const appId = requireAppId("uniid.data.create");
      const { DataService } = await import("@/modules/data");
      const raw = typeof first === "string"
        ? { dataType: first, data: second, ownerId: third }
        : asObject(first);
      const input = raw as DataCall;
      return DataService.create(
        {
          appId,
          dataType: requireString(input.dataType, "uniid.data.create.dataType"),
          data: input.data,
          ownerId: input.ownerId
        },
        { actor: functionActor(appId, opts.functionName) }
      );
    });
    ctx.setProp(uniidObj, "__dataCreate", dataCreateFn);
    dataCreateFn.dispose();

    const dataUpdateFn = hostFunction("__dataUpdate", async (first, second, third, fourth) => {
      const appId = requireAppId("uniid.data.update");
      const { DataService } = await import("@/modules/data");
      const raw = typeof first === "string"
        ? { dataType: first, recordId: second, data: third, ...asObject(fourth) }
        : asObject(first);
      const input = raw as DataCall;
      return DataService.update(
        {
          appId,
          dataType: requireString(input.dataType, "uniid.data.update.dataType"),
          recordId: requireString(input.recordId, "uniid.data.update.recordId"),
          data: input.data,
          merge: input.merge !== false
        },
        { actor: functionActor(appId, opts.functionName) }
      );
    });
    ctx.setProp(uniidObj, "__dataUpdate", dataUpdateFn);
    dataUpdateFn.dispose();

    const dataDeleteFn = hostFunction("__dataDelete", async (first, second) => {
      const appId = requireAppId("uniid.data.delete");
      const { DataService } = await import("@/modules/data");
      const { dataType, recordId } = normalizeRecordCall("uniid.data.delete", first, second);
      return DataService.delete({ appId, dataType, recordId }, { actor: functionActor(appId, opts.functionName) });
    });
    ctx.setProp(uniidObj, "__dataDelete", dataDeleteFn);
    dataDeleteFn.dispose();

    const dataFieldOpsFn = hostFunction("__dataFieldOps", async (first, second, third) => {
      const appId = requireAppId("uniid.data.fieldOps");
      const { DataService } = await import("@/modules/data");
      const raw = typeof first === "string"
        ? { dataType: first, recordId: second, ops: third }
        : asObject(first);
      const input = raw as DataCall;
      return DataService.fieldOps(
        {
          appId,
          dataType: requireString(input.dataType, "uniid.data.fieldOps.dataType"),
          recordId: requireString(input.recordId, "uniid.data.fieldOps.recordId"),
          ops: Array.isArray(input.ops) ? input.ops as never : []
        },
        { actor: functionActor(appId, opts.functionName) }
      );
    });
    ctx.setProp(uniidObj, "__dataFieldOps", dataFieldOpsFn);
    dataFieldOpsFn.dispose();

    const fileDownloadFn = hostFunction("__fileDownload", async (first) => {
      const appId = requireAppId("uniid.files.getDownloadUrl");
      const fileId = normalizeFileId("uniid.files.getDownloadUrl", first);
      await assertFileInApp(appId, fileId);
      const { FileService } = await import("@/modules/files");
      const url = await FileService.getDownloadUrl(fileId);
      return { url };
    });
    ctx.setProp(uniidObj, "__fileDownload", fileDownloadFn);
    fileDownloadFn.dispose();

    const fileShareFn = hostFunction("__fileShare", async (first, second) => {
      const appId = requireAppId("uniid.files.share");
      const fileId = normalizeFileId("uniid.files.share", first);
      const ttlSeconds = typeof first === "string"
        ? (typeof second === "number" ? second : undefined)
        : (typeof (asObject(first) as FileCall).ttlSeconds === "number" ? (asObject(first) as FileCall).ttlSeconds : undefined);
      await assertFileInApp(appId, fileId);
      const { FileService } = await import("@/modules/files");
      const token = await FileService.createShareTokenForAuthorizedFile(fileId, await appOwnerId(appId), ttlSeconds);
      return { token };
    });
    ctx.setProp(uniidObj, "__fileShare", fileShareFn);
    fileShareFn.dispose();

    const fileActiveShareFn = hostFunction("__fileActiveShare", async (first) => {
      const appId = requireAppId("uniid.files.getActiveShareToken");
      const fileId = normalizeFileId("uniid.files.getActiveShareToken", first);
      await assertFileInApp(appId, fileId);
      const { FileService } = await import("@/modules/files");
      return FileService.getActiveShareToken(fileId);
    });
    ctx.setProp(uniidObj, "__fileActiveShare", fileActiveShareFn);
    fileActiveShareFn.dispose();

    const fileRevokeSharesFn = hostFunction("__fileRevokeShares", async (first) => {
      const appId = requireAppId("uniid.files.revokeShareTokens");
      const fileId = normalizeFileId("uniid.files.revokeShareTokens", first);
      await assertFileInApp(appId, fileId);
      const { FileService } = await import("@/modules/files");
      return { revoked: await FileService.revokeShareTokensForAuthorizedFile(fileId) };
    });
    ctx.setProp(uniidObj, "__fileRevokeShares", fileRevokeSharesFn);
    fileRevokeSharesFn.dispose();

    const broadcastFn = hostFunction("__broadcast", async (first, second, third) => {
      const appId = requireAppId("uniid.broadcast");
      const { RealtimeService } = await import("@/modules/realtime");
      const raw = asObject(first);
      const channel = typeof first === "string"
        ? first
        : requireString(raw.channel, "uniid.broadcast.channel");
      const payload = typeof first === "string" ? second : raw.payload;
      const eventName = typeof first === "string"
        ? (typeof third === "string" ? third : "broadcast")
        : (typeof raw.event === "string" ? raw.event : "broadcast");
      return RealtimeService.broadcast(appId, channel, eventName, payload ?? null);
    });
    ctx.setProp(uniidObj, "__broadcast", broadcastFn);
    broadcastFn.dispose();

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

    const bootstrap = ctx.evalCode(`
      (() => {
        const rawFetch = uniid.__fetchRaw;
        uniid.fetch = async (url, init) => {
          const raw = await rawFetch(url, init);
          return {
            status: raw.status,
            ok: raw.ok,
            headers: raw.headers || {},
            text: raw.text,
            body: raw.text,
            truncated: !!raw.truncated,
            bytes: raw.bytes || 0,
            json: async () => JSON.parse(raw.text)
          };
        };
        uniid.data = {
          query: (...args) => uniid.__dataQuery(...args),
          get: (...args) => uniid.__dataGet(...args),
          create: (...args) => uniid.__dataCreate(...args),
          update: (...args) => uniid.__dataUpdate(...args),
          delete: (...args) => uniid.__dataDelete(...args),
          fieldOps: (...args) => uniid.__dataFieldOps(...args)
        };
        uniid.files = {
          getDownloadUrl: async (...args) => (await uniid.__fileDownload(...args)).url,
          share: async (...args) => (await uniid.__fileShare(...args)).token,
          getActiveShareToken: (...args) => uniid.__fileActiveShare(...args),
          revokeShareTokens: (...args) => uniid.__fileRevokeShares(...args)
        };
        uniid.broadcast = (...args) => uniid.__broadcast(...args);
      })()
    `);
    if (bootstrap.error) {
      const err = ctx.dump(bootstrap.error);
      bootstrap.error.dispose();
      throw new Error(typeof err === "string" ? err : JSON.stringify(err));
    }
    bootstrap.value.dispose();

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
