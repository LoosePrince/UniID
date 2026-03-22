/**
 * 对外文件 URL：/api/files/{ownerId}/{yyyy}/{mm}/{fileNamePart}[?query]
 * 与对象存储 Key 一致：`files/{ownerId}/{yyyy}/{mm}/{fileNamePart}`（见 `createObjectKey`）
 * `fileNamePart` 为 `{md5}.{ext}`，`ext` 来自上传时原始文件名的扩展名。
 */

const OBJECT_KEY_PREFIX = "files/";

export type BuildProxyFilePathOptions = {
  shareToken?: string;
};

/**
 * 生成相对路径。兼容旧调用：`buildProxyFilePath(objectKey, shareTokenString)`。
 */
export function buildProxyFilePath(
  objectKey: string,
  options?: BuildProxyFilePathOptions | string
): string {
  let opts: BuildProxyFilePathOptions = {};
  if (typeof options === "string") {
    opts = { shareToken: options };
  } else if (options) {
    opts = options;
  }

  const relative = objectKey.startsWith(OBJECT_KEY_PREFIX)
    ? objectKey.slice(OBJECT_KEY_PREFIX.length)
    : objectKey;

  const segments = relative.split("/").filter(Boolean);
  if (segments.length !== 4) {
    throw new Error("OBJECT_KEY_INVALID_FORMAT");
  }

  const [ownerId, yyyy, mm, tail] = segments;
  const path = `/api/files/${encodeURIComponent(ownerId)}/${encodeURIComponent(yyyy)}/${encodeURIComponent(mm)}/${encodeURIComponent(tail)}`;
  const qs = opts.shareToken
    ? `?share_token=${encodeURIComponent(opts.shareToken)}`
    : "";
  return `${path}${qs}`;
}

/** 从 URL 路径段还原存储对象 Key（与库内 `FileObject.objectKey` 一致） */
export function objectKeyFromPublicPathSegments(parts: {
  ownerId: string;
  year: string;
  month: string;
  filename: string;
}): string {
  return `files/${parts.ownerId}/${parts.year}/${parts.month}/${parts.filename}`;
}
