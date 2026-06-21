/**
 * S3 兼容存储客户端（singleton）。
 * 兼容 MinIO / Cloudflare R2 / AWS S3。
 */
import { S3Client, type S3ClientConfig } from "@aws-sdk/client-s3";
import { getSystemConfig, type SystemConfig } from "@/shared/system-config";

let internalClient: { signature: string; client: S3Client } | undefined;
let externalClient: { signature: string; client: S3Client } | undefined;

function buildConfig(c: SystemConfig, endpoint: string | undefined): S3ClientConfig {
  return {
    region: c.s3Region,
    forcePathStyle: c.s3ForcePathStyle,
    endpoint: endpoint || undefined,
  // 避免 presigned GetObject URL 附带 x-amz-checksum-mode（部分 S3 兼容网关未实现该校验）
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials:
      c.s3AccessKey && c.s3SecretKey
        ? { accessKeyId: c.s3AccessKey, secretAccessKey: c.s3SecretKey }
        : undefined
  };
}

export async function getS3InternalClient(): Promise<S3Client> {
  const c = await getSystemConfig();
  const signature = clientSignature(c, c.s3EndpointInternal);
  if (internalClient?.signature === signature) return internalClient.client;
  internalClient = { signature, client: new S3Client(buildConfig(c, c.s3EndpointInternal)) };
  return internalClient.client;
}

/** 用于颁发 presigned URL 给浏览器（外部可达地址）。 */
export async function getS3ExternalClient(): Promise<S3Client> {
  const c = await getSystemConfig();
  const endpoint = c.s3EndpointExternal || c.s3EndpointInternal;
  const signature = clientSignature(c, endpoint);
  if (externalClient?.signature === signature) return externalClient.client;
  externalClient = { signature, client: new S3Client(buildConfig(c, endpoint)) };
  return externalClient.client;
}

export async function bucketName(): Promise<string> {
  const b = (await getSystemConfig()).s3Bucket;
  if (!b) throw new Error("S3 bucket is not configured");
  return b;
}

function clientSignature(c: SystemConfig, endpoint: string): string {
  return JSON.stringify({
    endpoint,
    region: c.s3Region,
    forcePathStyle: c.s3ForcePathStyle,
    accessKey: c.s3AccessKey,
    secretKey: c.s3SecretKey
  });
}
