/**
 * S3 兼容存储客户端（singleton）。
 * 兼容 MinIO / Cloudflare R2 / AWS S3。
 */
import { S3Client, type S3ClientConfig } from "@aws-sdk/client-s3";
import { config } from "@/shared/config";

let internalClient: S3Client | undefined;
let externalClient: S3Client | undefined;

function buildConfig(endpoint: string | undefined): S3ClientConfig {
  const c = config();
  return {
    region: c.S3_REGION,
    forcePathStyle: c.S3_FORCE_PATH_STYLE,
    endpoint: endpoint || undefined,
  // 避免 presigned GetObject URL 附带 x-amz-checksum-mode（部分 S3 兼容网关未实现该校验）
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials:
      c.S3_ACCESS_KEY && c.S3_SECRET_KEY
        ? { accessKeyId: c.S3_ACCESS_KEY, secretAccessKey: c.S3_SECRET_KEY }
        : undefined
  };
}

export function getS3InternalClient(): S3Client {
  if (internalClient) return internalClient;
  internalClient = new S3Client(buildConfig(config().S3_ENDPOINT_INTERNAL));
  return internalClient;
}

/** 用于颁发 presigned URL 给浏览器（外部可达地址）。 */
export function getS3ExternalClient(): S3Client {
  if (externalClient) return externalClient;
  externalClient = new S3Client(
    buildConfig(config().S3_ENDPOINT_EXTERNAL || config().S3_ENDPOINT_INTERNAL)
  );
  return externalClient;
}

export function bucketName(): string {
  const b = config().S3_BUCKET;
  if (!b) throw new Error("S3_BUCKET is not configured");
  return b;
}
