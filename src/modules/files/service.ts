/**
 * FileService — 上传、下载链接、分享、删除。
 *
 * 设计：
 *   - 简单上传：multipart/form-data POST → 直接转给 S3 PutObject
 *   - 大文件 multipart：客户端走 createMultipartUpload → 多次 UploadPart → completeMultipartUpload
 *     （第一版先实现简单上传 + presigned 下载；multipart 留 hook）
 *   - 元数据落库：FileObject
 *   - 分享 token：FileShareToken
 */
import {
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/shared/prisma";
import { ApiError } from "@/shared/errors";
import { bucketName, getS3ExternalClient, getS3InternalClient, peekImageSize, isImageMime } from "@/shared/storage";
import { config } from "@/shared/config";
import { bus } from "@/shared/bus";
import { QuotaService } from "@/shared/quota";

const now = () => Math.floor(Date.now() / 1000);

function makeObjectKey(ownerId: string, originalName: string): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const id = randomBytes(8).toString("base64url");
  const ext = originalName.includes(".") ? "." + originalName.split(".").pop()!.toLowerCase() : "";
  return `${ownerId}/${yyyy}/${mm}/${id}${ext}`;
}

function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export interface UploadResult {
  id: string;
  objectKey: string;
  bucket: string;
  size: number;
  mimeType: string;
  originalName: string;
  visibility: "private" | "public";
}

export class FileService {
  static async upload(input: {
    file: { buffer: Buffer; mimeType: string; originalName: string };
    ownerId: string;
    appId: string | null;
    visibility?: "private" | "public";
  }): Promise<UploadResult> {
    const c = config();
    if (input.file.buffer.byteLength > c.FILE_MAX_SIZE_BYTES) {
      throw new ApiError("FILE_TOO_LARGE");
    }
    const bucket = bucketName();
    const objectKey = makeObjectKey(input.ownerId, input.file.originalName);
    const checksum = sha256Hex(input.file.buffer);

    // 图片元数据预提取（解析 magic-number 头部，PNG/JPEG/GIF/WebP）
    let width: number | null = null;
    let height: number | null = null;
    if (isImageMime(input.file.mimeType)) {
      const meta = peekImageSize(input.file.buffer);
      if (meta) {
        width = meta.width;
        height = meta.height;
      }
    }

    // 月度存储配额预检（写库前抛 QUOTA_EXCEEDED）
    if (input.appId) {
      await QuotaService.consume(input.appId, "storageBytes", input.file.buffer.byteLength);
    }

    try {
      await getS3InternalClient().send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: objectKey,
          Body: input.file.buffer,
          ContentType: input.file.mimeType,
          ContentLength: input.file.buffer.byteLength,
          ACL: input.visibility === "public" ? "public-read" : undefined
        })
      );
    } catch (err) {
      // 上传失败 → 回滚配额累计
      if (input.appId) {
        await QuotaService.releaseStorage(input.appId, input.file.buffer.byteLength).catch(() => {});
      }
      throw new ApiError("FILE_UPLOAD_FAILED", { details: { cause: String(err) } });
    }

    const t = now();
    const row = await prisma.fileObject.create({
      data: {
        appId: input.appId,
        ownerId: input.ownerId,
        bucket,
        objectKey,
        originalName: input.file.originalName,
        mimeType: input.file.mimeType,
        size: input.file.buffer.byteLength,
        checksum,
        checksumAlgo: "sha256",
        width,
        height,
        visibility: input.visibility ?? "private",
        createdAt: t,
        updatedAt: t
      }
    });

    bus.emit("file.uploaded", {
      appId: input.appId,
      ownerId: input.ownerId,
      fileId: row.id,
      objectKey: row.objectKey,
      size: row.size,
      mimeType: row.mimeType,
      at: t
    });

    return {
      id: row.id,
      objectKey: row.objectKey,
      bucket: row.bucket,
      size: row.size,
      mimeType: row.mimeType,
      originalName: row.originalName,
      visibility: row.visibility as "private" | "public"
    };
  }

  static async getDownloadUrl(fileId: string): Promise<string> {
    const file = await prisma.fileObject.findUnique({ where: { id: fileId } });
    if (!file || file.deletedAt) throw new ApiError("FILE_NOT_FOUND");
    const client = getS3ExternalClient();
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: file.bucket, Key: file.objectKey }),
      { expiresIn: config().FILE_PRESIGN_TTL_SECONDS }
    );
    return url;
  }

  static async createShareToken(fileId: string, createdById: string, ttlSeconds?: number): Promise<string> {
    const file = await prisma.fileObject.findUnique({ where: { id: fileId } });
    if (!file || file.deletedAt) throw new ApiError("FILE_NOT_FOUND");
    if (file.ownerId !== createdById) throw new ApiError("FILE_FORBIDDEN");
    return this.createShareTokenForAuthorizedFile(fileId, createdById, ttlSeconds);
  }

  static async createShareTokenForAuthorizedFile(
    fileId: string,
    createdById: string,
    ttlSeconds?: number
  ): Promise<string> {
    const file = await prisma.fileObject.findUnique({ where: { id: fileId } });
    if (!file || file.deletedAt) throw new ApiError("FILE_NOT_FOUND");
    const c = config();
    const token = randomBytes(24).toString("base64url");
    const t = now();
    await prisma.fileShareToken.create({
      data: {
        fileId,
        token,
        expiresAt: t + (ttlSeconds ?? c.FILE_SHARE_TOKEN_TTL_SECONDS),
        createdById,
        createdAt: t
      }
    });
    return token;
  }

  static async getActiveShareToken(fileId: string): Promise<{ token: string; expiresAt: number } | null> {
    return prisma.fileShareToken.findFirst({
      where: {
        fileId,
        revokedAt: null,
        expiresAt: { gt: now() }
      },
      orderBy: { createdAt: "desc" },
      select: { token: true, expiresAt: true }
    });
  }

  static async revokeShareTokens(fileId: string, actorId: string): Promise<number> {
    const file = await prisma.fileObject.findUnique({ where: { id: fileId } });
    if (!file || file.deletedAt) throw new ApiError("FILE_NOT_FOUND");
    if (file.ownerId !== actorId) throw new ApiError("FILE_FORBIDDEN");
    return this.revokeShareTokensForAuthorizedFile(fileId);
  }

  static async revokeShareTokensForAuthorizedFile(fileId: string): Promise<number> {
    const result = await prisma.fileShareToken.updateMany({
      where: { fileId, revokedAt: null },
      data: { revokedAt: now() }
    });
    return result.count;
  }

  static async resolveShareToken(token: string): Promise<string> {
    const row = await prisma.fileShareToken.findUnique({
      where: { token },
      include: { file: true }
    });
    if (!row || row.revokedAt) throw new ApiError("FILE_SHARE_TOKEN_INVALID");
    if (row.expiresAt <= now()) throw new ApiError("FILE_SHARE_TOKEN_INVALID");
    if (!row.file || row.file.deletedAt) throw new ApiError("FILE_NOT_FOUND");
    const url = await getSignedUrl(
      getS3ExternalClient(),
      new GetObjectCommand({ Bucket: row.file.bucket, Key: row.file.objectKey }),
      { expiresIn: 300 }
    );
    return url;
  }

  static async delete(fileId: string, actorId: string): Promise<void> {
    const file = await prisma.fileObject.findUnique({ where: { id: fileId } });
    if (!file || file.deletedAt) throw new ApiError("FILE_NOT_FOUND");
    if (file.ownerId !== actorId) throw new ApiError("FILE_FORBIDDEN");
    await this.deleteAuthorizedFile(fileId);
  }

  static async deleteAuthorizedFile(fileId: string): Promise<void> {
    const file = await prisma.fileObject.findUnique({ where: { id: fileId } });
    if (!file || file.deletedAt) throw new ApiError("FILE_NOT_FOUND");
    try {
      await getS3InternalClient().send(
        new DeleteObjectCommand({ Bucket: file.bucket, Key: file.objectKey })
      );
    } catch {
      // 仍然标记软删除；S3 残余对象可由清理任务回收
    }
    const t = now();
    await prisma.fileObject.update({ where: { id: fileId }, data: { deletedAt: t, updatedAt: t } });
    if (file.appId) {
      await QuotaService.releaseStorage(file.appId, file.size).catch(() => {});
    }
    bus.emit("file.deleted", { appId: file.appId, ownerId: file.ownerId, fileId, at: t });
  }

  static async list(input: { appId?: string; ownerId?: string; limit?: number }) {
    const limit = Math.min(input.limit ?? 50, 200);
    return prisma.fileObject.findMany({
      where: {
        deletedAt: null,
        appId: input.appId,
        ownerId: input.ownerId
      },
      orderBy: { createdAt: "desc" },
      take: limit
    });
  }

  // ---------------------------------------------------------------------------
  // Multipart upload —— 客户端分片上传大文件
  //
  //   1. initMultipart  → 创建 FileObject(uploadId) 记录 + S3 CreateMultipartUpload
  //   2. uploadPart     → 直接转给 S3 UploadPart，落库 FileChunk
  //   3. completeMultipart → S3 CompleteMultipartUpload，写入最终 size + 释放 uploadId
  //   4. abortMultipart → S3 AbortMultipartUpload，删 FileObject
  // ---------------------------------------------------------------------------

  static async initMultipart(input: {
    ownerId: string;
    appId: string | null;
    originalName: string;
    mimeType: string;
    visibility?: "private" | "public";
  }): Promise<{ fileId: string; uploadId: string; bucket: string; objectKey: string }> {
    const bucket = bucketName();
    const objectKey = makeObjectKey(input.ownerId, input.originalName);
    const t = now();

    const mp = await getS3InternalClient().send(
      new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: objectKey,
        ContentType: input.mimeType,
        ACL: input.visibility === "public" ? "public-read" : undefined
      })
    );
    if (!mp.UploadId) throw new ApiError("FILE_UPLOAD_FAILED", { message: "S3 did not return UploadId" });

    const row = await prisma.fileObject.create({
      data: {
        appId: input.appId,
        ownerId: input.ownerId,
        bucket,
        objectKey,
        originalName: input.originalName,
        mimeType: input.mimeType,
        size: 0,
        uploadId: mp.UploadId,
        visibility: input.visibility ?? "private",
        createdAt: t,
        updatedAt: t
      }
    });

    return { fileId: row.id, uploadId: mp.UploadId, bucket, objectKey };
  }

  static async uploadPart(input: {
    fileId: string;
    partNumber: number;
    body: Buffer;
    actorId: string;
  }): Promise<{ etag: string; partNumber: number; size: number }> {
    if (input.partNumber < 1 || input.partNumber > 10_000) {
      throw new ApiError("FILE_MULTIPART_INVALID", { message: "partNumber 必须在 1..10000" });
    }
    const file = await prisma.fileObject.findUnique({ where: { id: input.fileId } });
    if (!file || file.deletedAt) throw new ApiError("FILE_NOT_FOUND");
    if (file.ownerId !== input.actorId) throw new ApiError("FILE_FORBIDDEN");
    if (!file.uploadId) throw new ApiError("FILE_MULTIPART_INVALID", { message: "文件已完成上传" });

    const res = await getS3InternalClient().send(
      new UploadPartCommand({
        Bucket: file.bucket,
        Key: file.objectKey,
        UploadId: file.uploadId,
        PartNumber: input.partNumber,
        Body: input.body,
        ContentLength: input.body.byteLength
      })
    );
    if (!res.ETag) throw new ApiError("FILE_UPLOAD_FAILED", { message: "UploadPart 未返回 ETag" });

    await prisma.fileChunk.upsert({
      where: { uploadId_partNumber: { uploadId: file.uploadId, partNumber: input.partNumber } },
      create: {
        fileId: file.id,
        uploadId: file.uploadId,
        partNumber: input.partNumber,
        etag: res.ETag,
        size: input.body.byteLength,
        createdAt: now()
      },
      update: { etag: res.ETag, size: input.body.byteLength }
    });

    return { etag: res.ETag, partNumber: input.partNumber, size: input.body.byteLength };
  }

  static async completeMultipart(input: {
    fileId: string;
    actorId: string;
  }): Promise<UploadResult> {
    const file = await prisma.fileObject.findUnique({ where: { id: input.fileId } });
    if (!file || file.deletedAt) throw new ApiError("FILE_NOT_FOUND");
    if (file.ownerId !== input.actorId) throw new ApiError("FILE_FORBIDDEN");
    if (!file.uploadId) throw new ApiError("FILE_MULTIPART_INVALID", { message: "文件已完成上传" });

    const parts = await prisma.fileChunk.findMany({
      where: { uploadId: file.uploadId },
      orderBy: { partNumber: "asc" }
    });
    if (parts.length === 0) {
      throw new ApiError("FILE_MULTIPART_INVALID", { message: "没有任何已上传分片" });
    }

    await getS3InternalClient().send(
      new CompleteMultipartUploadCommand({
        Bucket: file.bucket,
        Key: file.objectKey,
        UploadId: file.uploadId,
        MultipartUpload: {
          Parts: parts.map((p: { etag: string; partNumber: number }) => ({
            ETag: p.etag,
            PartNumber: p.partNumber
          }))
        }
      })
    );

    const totalSize = parts.reduce((a: number, b: { size: number }) => a + b.size, 0);
    const t = now();

    // 月度存储配额累计（按总大小一次性记账）
    if (file.appId) {
      await QuotaService.consume(file.appId, "storageBytes", totalSize);
    }

    const updated = await prisma.fileObject.update({
      where: { id: file.id },
      data: { size: totalSize, uploadId: null, updatedAt: t }
    });

    bus.emit("file.uploaded", {
      appId: updated.appId,
      ownerId: updated.ownerId,
      fileId: updated.id,
      objectKey: updated.objectKey,
      size: updated.size,
      mimeType: updated.mimeType,
      at: t
    });

    return {
      id: updated.id,
      objectKey: updated.objectKey,
      bucket: updated.bucket,
      size: updated.size,
      mimeType: updated.mimeType,
      originalName: updated.originalName,
      visibility: updated.visibility as "private" | "public"
    };
  }

  static async abortMultipart(input: { fileId: string; actorId: string }): Promise<void> {
    const file = await prisma.fileObject.findUnique({ where: { id: input.fileId } });
    if (!file) throw new ApiError("FILE_NOT_FOUND");
    if (file.ownerId !== input.actorId) throw new ApiError("FILE_FORBIDDEN");
    if (!file.uploadId) throw new ApiError("FILE_MULTIPART_INVALID", { message: "文件没有进行中的 multipart 上传" });

    await getS3InternalClient()
      .send(new AbortMultipartUploadCommand({
        Bucket: file.bucket,
        Key: file.objectKey,
        UploadId: file.uploadId
      }))
      .catch(() => {});

    await prisma.fileChunk.deleteMany({ where: { uploadId: file.uploadId } });
    await prisma.fileObject.delete({ where: { id: file.id } });
  }
}
