/**
 * 公共类型定义。SDK 不假设 UniID 后端返回字段顺序，所有响应都使用 envelope。
 */

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId?: string;
  };
}

export interface ApiSuccessEnvelope<T> {
  data: T;
  requestId?: string;
}

export type ApiResponse<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;

export class UniIDError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;
  readonly requestId?: string;
  constructor(envelope: ApiErrorEnvelope["error"]) {
    super(envelope.message);
    this.name = "UniIDError";
    this.code = envelope.code;
    this.details = envelope.details;
    this.requestId = envelope.requestId;
  }
}

export interface UniIDUser {
  id: string;
  username: string;
  displayName?: string | null;
  avatar?: string | null;
  email?: string | null;
  role?: string;
  locale?: string;
}

export interface UniIDSession {
  user: UniIDUser;
  appId: string;
  authType: "full" | "restricted";
  scope?: Record<string, unknown> | null;
  accessToken: string;
  accessTokenExpiresAt: number; // unix seconds
  refreshToken: string;
}

export type AuthChangeListener = (user: UniIDUser | null) => void;

export interface UniIDOptions {
  /** UniID 服务的根 URL，如 `https://uniid.example.com`（不含末尾 /）。 */
  url: string;
  /** 你的 App ID。 */
  appId: string;
  /** iframe 挂载点：CSS 选择器或元素。默认创建 `<div>` 追加到 body。 */
  mount?: string | HTMLElement;
  /** iframe 主题：`auto` 根据系统 / 显式 `light|dark`。 */
  theme?: "auto" | "light" | "dark";
  /** session 存储 key 前缀，便于多 App 共存于同源页面。 */
  storageKey?: string;
  /** 是否自动刷新（即将过期时自动 refresh）。默认 true。 */
  autoRefresh?: boolean;
  /** 当请求带凭证（cookie）时使用，仅 UniID 自身页面有用。默认 false。 */
  withCredentials?: boolean;
}

export interface AuthorizeOptions {
  /** restricted 模式：仅请求部分字段，UniID 端按 scope 颁发。 */
  authType?: "full" | "restricted";
  scope?: Record<string, unknown>;
  /** 提示当前请求来源（fallback 时使用 window.location.origin）。 */
  parentOrigin?: string;
}

export interface FromQueryOptions<T = unknown> {
  select?: string[];
  where?: Record<string, unknown>;
  orderBy?: Array<Record<string, "asc" | "desc">>;
  limit?: number;
  cursor?: string;
}

export interface RecordEnvelope<T = unknown> {
  id: string;
  appId: string;
  dataType: string;
  ownerId: string | null;
  data: T;
  createdAt: number;
  updatedAt: number;
}

export interface FieldOp {
  type: "increment" | "push" | "set" | "unset";
  path: string;
  value?: unknown;
}

export interface TransitionOptions<T = unknown> {
  /** 状态流转时附带的数据补丁，默认按 merge 语义合并。 */
  data?: Partial<T>;
  /** 只进入 CommandContext，不会直接写入记录。 */
  metadata?: Record<string, unknown>;
  /** 默认由后端按 true 处理。 */
  merge?: boolean;
}

export interface UploadOptions {
  appId?: string;
  visibility?: "private" | "public";
  metadata?: Record<string, unknown>;
}

export interface FileInfo {
  id: string;
  appId: string | null;
  ownerId: string;
  bucket: string;
  objectKey: string;
  originalName: string;
  mimeType: string;
  size: number;
  visibility: "private" | "public";
  width?: number | null;
  height?: number | null;
  createdAt: number;
}
