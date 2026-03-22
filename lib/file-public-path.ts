/**
 * 对外文件 URL：/api/files/{appId}/{fileId}.{ext}[?query]
 * - appId：业务应用标识（如 demo-blog），便于阅读；存库在 FileObject.appId
 * - 后缀来自 originalName，仅美化 URL，解析时仍以 fileId 为准
 */

const RESERVED_APP_SEGMENTS = new Set(["upload", "share", "public"]);

export function sanitizeAppIdForPath(raw: string | null | undefined): string {
  const s = String(raw ?? "_")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .slice(0, 64);
  const base = s || "_";
  if (RESERVED_APP_SEGMENTS.has(base.toLowerCase())) {
    return `_${base}`;
  }
  return base;
}

/** 从原始文件名取扩展名（无则 bin），用于 URL 段 */
export function extensionForPublicUrl(originalName: string | null | undefined): string {
  if (!originalName) return "bin";
  const m = originalName.match(/\.([a-zA-Z0-9]{1,8})$/);
  return m ? m[1].toLowerCase() : "bin";
}

/** fileKey = fileId 或 fileId.ext（ext 为 1～8 位字母数字） */
export function encodeFileKey(fileId: string, originalName?: string | null): string {
  const ext = extensionForPublicUrl(originalName ?? null);
  return `${fileId}.${ext}`;
}

/**
 * 从路径段 fileKey 还原 fileId（去掉可选的「假后缀」）
 */
export function parseFileIdFromFileKey(fileKey: string): string {
  const key = decodeURIComponent(fileKey);
  const lastDot = key.lastIndexOf(".");
  if (lastDot <= 0) return key;
  const after = key.slice(lastDot + 1);
  if (!/^[a-zA-Z0-9]{1,8}$/.test(after)) return key;
  return key.slice(0, lastDot);
}

export function appIdMatchesStored(
  stored: string | null | undefined,
  pathAppId: string
): boolean {
  if (stored == null || stored === "") return true;
  return sanitizeAppIdForPath(stored) === sanitizeAppIdForPath(pathAppId);
}

export type BuildProxyFilePathOptions = {
  appId?: string | null;
  originalName?: string | null;
  shareToken?: string;
};

/**
 * 生成相对路径。兼容旧调用：`buildProxyFilePath(id, shareTokenString)`。
 */
export function buildProxyFilePath(
  fileId: string,
  options?: BuildProxyFilePathOptions | string
): string {
  let opts: BuildProxyFilePathOptions = {};
  if (typeof options === "string") {
    opts = { shareToken: options };
  } else if (options) {
    opts = options;
  }

  const app = sanitizeAppIdForPath(opts.appId);
  const key = encodeFileKey(fileId, opts.originalName);
  const qs = opts.shareToken
    ? `?share_token=${encodeURIComponent(opts.shareToken)}`
    : "";

  return `/api/files/${encodeURIComponent(app)}/${encodeURIComponent(key)}${qs}`;
}
