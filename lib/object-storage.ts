import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";

type StorageConfig = {
  endpointInternal: string | null;
  endpointExternal: string | null;
  bucket: string;
  accessKey: string;
  secretKey: string;
};

function normalizeEndpoint(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function getStorageConfig(): StorageConfig {
  const endpointInternal = process.env.OBJECT_STORAGE_ENDPOINT_INTERNAL?.trim();
  const endpointExternal = process.env.OBJECT_STORAGE_ENDPOINT_EXTERNAL?.trim();
  const bucket = process.env.OBJECT_STORAGE_BUCKET?.trim();
  const accessKey = process.env.OBJECT_STORAGE_ACCESS_KEY?.trim();
  const secretKey = process.env.OBJECT_STORAGE_SECRET_KEY?.trim();

  if (!bucket || !accessKey || !secretKey) {
    throw new Error("OBJECT_STORAGE_CONFIG_MISSING");
  }

  if (!endpointInternal && !endpointExternal) {
    throw new Error("OBJECT_STORAGE_CONFIG_MISSING");
  }

  return {
    endpointInternal: endpointInternal ?? null,
    endpointExternal: endpointExternal ?? null,
    bucket,
    accessKey,
    secretKey
  };
}

const cachedClients = new Map<string, S3Client>();

function getCandidateEndpoints(cfg: StorageConfig): string[] {
  const candidates = [
    cfg.endpointInternal ? normalizeEndpoint(cfg.endpointInternal) : "",
    cfg.endpointExternal ? normalizeEndpoint(cfg.endpointExternal) : ""
  ].filter(Boolean);
  return [...new Set(candidates)];
}

function shouldTryNextEndpoint(error: unknown): boolean {
  if (!(error instanceof Error)) return true;
  const code = (error as Error & { code?: string }).code ?? "";
  if (code === "ENOTFOUND" || code === "ECONNREFUSED" || code === "ETIMEDOUT") {
    return true;
  }
  const message = error.message || "";
  return /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|TimeoutError|getaddrinfo/i.test(message);
}

function getClient(endpoint: string, cfg: StorageConfig): S3Client {
  const normalized = normalizeEndpoint(endpoint);
  const cached = cachedClients.get(normalized);
  if (cached) return cached;

  const client = new S3Client({
    region: "auto",
    endpoint: normalized,
    forcePathStyle: true,
    credentials: {
      accessKeyId: cfg.accessKey,
      secretAccessKey: cfg.secretKey
    }
  });
  cachedClients.set(normalized, client);
  return client;
}

async function sendObjectStorageCommand(
  buildCommand: () => PutObjectCommand | DeleteObjectCommand
): Promise<void> {
  const cfg = getStorageConfig();
  const endpoints = getCandidateEndpoints(cfg);
  let lastError: unknown = null;

  for (let i = 0; i < endpoints.length; i += 1) {
    const endpoint = endpoints[i];
    try {
      const client = getClient(endpoint, cfg);
      await client.send(buildCommand());
      return;
    } catch (error) {
      lastError = error;
      const isLast = i === endpoints.length - 1;
      if (isLast || !shouldTryNextEndpoint(error)) {
        throw error;
      }
    }
  }

  if (lastError) throw lastError;
  throw new Error("OBJECT_STORAGE_UNAVAILABLE");
}

function getPresignExpiresSeconds(): number {
  const raw = process.env.FILE_PRESIGN_EXPIRES_SECONDS?.trim();
  const parsed = raw ? Number(raw) : 300;
  if (!Number.isFinite(parsed)) return 300;
  return Math.max(60, Math.min(Math.floor(parsed), 7 * 24 * 60 * 60));
}

/**
 * 生成 GetObject 预签名 URL，浏览器 / `<img src>` 跟随 302 后即可直连桶拉流。
 * 签名主机与 `OBJECT_STORAGE_ENDPOINT_EXTERNAL`（无则回退 internal）一致，公网访问请配置外部 endpoint。
 */
export async function getPresignedGetObjectUrl(args: {
  objectKey: string;
  /** 原始文件名，用于 Content-Disposition */
  inlineFilename?: string;
  /** 默认 inline（浏览器内预览/打开）；attachment 为「另存为」式下载 */
  disposition?: "inline" | "attachment";
}): Promise<string> {
  const cfg = getStorageConfig();
  const endpoint = cfg.endpointExternal
    ? normalizeEndpoint(cfg.endpointExternal)
    : cfg.endpointInternal
      ? normalizeEndpoint(cfg.endpointInternal)
      : "";
  if (!endpoint) {
    throw new Error("OBJECT_STORAGE_CONFIG_MISSING");
  }

  const client = getClient(endpoint, cfg);
  const expiresIn = getPresignExpiresSeconds();
  const disposition = args.disposition ?? "inline";

  const filenamePart =
    args.inlineFilename != null && args.inlineFilename !== ""
      ? `; filename*=UTF-8''${encodeURIComponent(args.inlineFilename)}`
      : "";

  const command = new GetObjectCommand({
    Bucket: cfg.bucket,
    Key: args.objectKey,
    ResponseContentDisposition: `${disposition}${filenamePart}`
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * 从上传时的原始文件名取扩展名（仅最后一段，小写），无则 `bin`
 */
export function extensionFromOriginalFilename(originalFilename: string): string {
  const name = String(originalFilename ?? "").trim();
  const m = name.match(/\.([a-zA-Z0-9]{1,16})$/);
  return m ? m[1].toLowerCase() : "bin";
}

/**
 * 对象键：`files/{ownerId}/{yyyy}/{mm}/{md5}.{ext}`
 * - `md5` 为文件内容的 MD5 十六进制（小写）
 * - `ext` 来自上传时的原始文件名扩展名（不含主文件名）
 */
export function createObjectKey(
  ownerId: string,
  contentMd5Hex: string,
  originalFilename: string
): string {
  const ext = extensionFromOriginalFilename(originalFilename);
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `files/${ownerId}/${yyyy}/${mm}/${contentMd5Hex}.${ext}`;
}

export async function getObjectStreamFromStorage(objectKey: string): Promise<{
  body: ReadableStream<Uint8Array>;
  contentType: string;
  contentLength?: number;
}> {
  const cfg = getStorageConfig();
  const endpoints = getCandidateEndpoints(cfg);
  let lastError: unknown = null;

  for (let i = 0; i < endpoints.length; i += 1) {
    const endpoint = endpoints[i];
    try {
      const client = getClient(endpoint, cfg);
      const out = await client.send(
        new GetObjectCommand({
          Bucket: cfg.bucket,
          Key: objectKey
        })
      );
      const raw = out.Body;
      if (!raw) {
        throw new Error("EMPTY_OBJECT_BODY");
      }
      const contentType = out.ContentType ?? "application/octet-stream";
      const contentLength =
        typeof out.ContentLength === "number" ? out.ContentLength : undefined;
      const nodeReadable = raw as Readable;
      const body = Readable.toWeb(nodeReadable) as ReadableStream<Uint8Array>;
      return { body, contentType, contentLength };
    } catch (error) {
      lastError = error;
      const isLast = i === endpoints.length - 1;
      if (isLast || !shouldTryNextEndpoint(error)) {
        throw error;
      }
    }
  }

  if (lastError) throw lastError;
  throw new Error("OBJECT_STORAGE_UNAVAILABLE");
}

export async function uploadObject(args: {
  objectKey: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  const cfg = getStorageConfig();
  await sendObjectStorageCommand(
    () =>
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: args.objectKey,
        Body: args.body,
        ContentType: args.contentType
      })
  );
}

export async function deleteObject(objectKey: string): Promise<void> {
  const cfg = getStorageConfig();
  await sendObjectStorageCommand(
    () =>
      new DeleteObjectCommand({
        Bucket: cfg.bucket,
        Key: objectKey
      })
  );
}

export function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function md5Hex(buffer: Buffer): string {
  return createHash("md5").update(buffer).digest("hex");
}

export function getObjectStorageBucket(): string {
  return getStorageConfig().bucket;
}
