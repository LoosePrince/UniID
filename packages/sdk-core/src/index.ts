/**
 * UniID SDK 入口。
 *
 * 用法：
 *   import { UniID } from "@uniid/sdk";
 *   const uniid = new UniID({ url: "https://uniid.example.com", appId: "app_xxx" });
 *   await uniid.auth.login();
 *   const posts = await uniid.from("post").select(["id","data.title"]).limit(10).run();
 */
import { AuthNamespace } from "./auth";
import { DataNamespace, type FromQuery } from "./data";
import { FilesNamespace } from "./files";
import { FunctionsNamespace } from "./functions";
import { RealtimeNamespace } from "./realtime";
import { policy } from "./policy";
import { createSessionStorage } from "./storage";
import type { UniIDOptions } from "./types";

export { UniIDError } from "./types";
export type {
  UniIDOptions,
  UniIDUser,
  UniIDSession,
  AuthChangeListener,
  AuthorizeOptions,
  FromQueryOptions,
  RecordEnvelope,
  FieldOp,
  TransitionOptions,
  UploadOptions,
  FileInfo
} from "./types";
export { policy } from "./policy";
export type {
  PolicyAction,
  PolicyCondition,
  PolicyConditionValue,
  PolicyDocumentObject,
  PolicyDocumentV2Object,
  PolicyFieldRule,
  PolicyRule,
  PolicyVariable,
  LegacyPolicyDocumentObject,
  RuleInput
} from "./policy";
export type { RealtimeChannel } from "./realtime";
export type { FromQuery } from "./data";

export class UniID {
  readonly auth: AuthNamespace;
  readonly files: FilesNamespace;
  readonly realtime: RealtimeNamespace;
  readonly functions: FunctionsNamespace;
  readonly policy = policy;
  private readonly data: DataNamespace;

  constructor(options: UniIDOptions) {
    const url = options.url.replace(/\/$/, "");
    const opts = {
      url,
      appId: options.appId,
      mount: options.mount,
      theme: options.theme ?? "auto",
      storageKey: options.storageKey ?? `uniid:${options.appId}`,
      autoRefresh: options.autoRefresh ?? true,
      withCredentials: options.withCredentials ?? false
    } as const;

    const storage = createSessionStorage(opts.storageKey);
    this.auth = new AuthNamespace(opts, storage);
    this.data = new DataNamespace({ url, appId: options.appId }, this.auth);
    this.files = new FilesNamespace({ url, appId: options.appId }, this.auth);
    this.realtime = new RealtimeNamespace({ url, appId: options.appId }, this.auth);
    this.functions = new FunctionsNamespace({ url, appId: options.appId }, this.auth);
  }

  /** 数据资源访问入口：`uniid.from("post").select([...])` */
  from<T = unknown>(dataType: string): FromQuery<T> {
    return this.data.from<T>(dataType);
  }
}

export default UniID;
