/**
 * FilesNamespace — 上传 / 下载 URL / 分享 / 列表 / 删除。
 */
import { request } from "./http";
import type { AuthNamespace } from "./auth";
import type { FileInfo, UniIDOptions, UploadOptions } from "./types";

export class FilesNamespace {
  constructor(
    private readonly opts: Required<Pick<UniIDOptions, "url" | "appId">>,
    private readonly auth: AuthNamespace
  ) {}

  async upload(blob: Blob | File, options?: UploadOptions): Promise<FileInfo> {
    await this.auth.ensureFreshToken();
    const fd = new FormData();
    const name = (blob instanceof File ? blob.name : (options?.metadata?.name as string)) ?? "upload.bin";
    fd.append("file", blob, name);
    fd.append("appId", options?.appId ?? this.opts.appId);
    if (options?.visibility) fd.append("visibility", options.visibility);
    if (options?.metadata) fd.append("metadata", JSON.stringify(options.metadata));

    return request<FileInfo>(this.opts.url, "/api/v1/files/upload", {
      method: "POST",
      body: fd,
      json: false,
      headers: this.auth.authHeader()
    });
  }

  async getInfo(fileId: string): Promise<FileInfo> {
    await this.auth.ensureFreshToken();
    return request<FileInfo>(this.opts.url, `/api/v1/files/${encodeURIComponent(fileId)}`, {
      method: "GET",
      headers: this.auth.authHeader()
    });
  }

  async getDownloadUrl(fileId: string, opts?: { expiresIn?: number }): Promise<string> {
    await this.auth.ensureFreshToken();
    const res = await request<{ url: string }>(this.opts.url, `/api/v1/files/${encodeURIComponent(fileId)}/download-url`, {
      method: "GET",
      query: { expiresIn: opts?.expiresIn },
      headers: this.auth.authHeader()
    });
    return res.url;
  }

  async share(fileId: string, opts?: { expiresIn?: number }): Promise<{ token: string; url: string; expiresAt: number }> {
    await this.auth.ensureFreshToken();
    return request(this.opts.url, "/api/v1/files/share", {
      method: "POST",
      body: { fileId, expiresIn: opts?.expiresIn },
      headers: this.auth.authHeader()
    });
  }

  async delete(fileId: string): Promise<{ id: string }> {
    await this.auth.ensureFreshToken();
    return request(this.opts.url, `/api/v1/files/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
      headers: this.auth.authHeader()
    });
  }

  // ---------------------------------------------------------------------------
  // 大文件分片上传：客户端把文件切成 partSize 字节小块，逐块上传。
  //
  //   const handle = await files.initMultipart({ name, mimeType });
  //   for (let i = 0; i < parts.length; i++) {
  //     await files.uploadPart(handle.fileId, i + 1, parts[i]);
  //   }
  //   const info = await files.completeMultipart(handle.fileId);
  // ---------------------------------------------------------------------------
  async initMultipart(opts: {
    name: string;
    mimeType: string;
    visibility?: "private" | "public";
  }): Promise<{ fileId: string; uploadId: string; bucket: string; objectKey: string }> {
    await this.auth.ensureFreshToken();
    const res = await request<{
      upload: { fileId: string; uploadId: string; bucket: string; objectKey: string };
    }>(this.opts.url, "/api/v1/files/multipart/init", {
      method: "POST",
      body: { originalName: opts.name, mimeType: opts.mimeType, visibility: opts.visibility },
      headers: this.auth.authHeader()
    });
    return res.upload;
  }

  async uploadPart(
    fileId: string,
    partNumber: number,
    chunk: Blob | ArrayBuffer | Uint8Array
  ): Promise<{ etag: string; partNumber: number; size: number }> {
    await this.auth.ensureFreshToken();
    const body =
      chunk instanceof Blob
        ? chunk
        : chunk instanceof ArrayBuffer
          ? new Blob([chunk])
          : new Blob([chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) as ArrayBuffer]);
    const res = await request<{ part: { etag: string; partNumber: number; size: number } }>(
      this.opts.url,
      `/api/v1/files/multipart/${encodeURIComponent(fileId)}/part`,
      {
        method: "POST",
        query: { partNumber },
        body,
        json: false,
        headers: { ...this.auth.authHeader(), "Content-Type": "application/octet-stream" }
      }
    );
    return res.part;
  }

  async completeMultipart(fileId: string): Promise<FileInfo> {
    await this.auth.ensureFreshToken();
    const res = await request<{ file: FileInfo }>(
      this.opts.url,
      `/api/v1/files/multipart/${encodeURIComponent(fileId)}/complete`,
      { method: "POST", headers: this.auth.authHeader() }
    );
    return res.file;
  }

  async abortMultipart(fileId: string): Promise<void> {
    await this.auth.ensureFreshToken();
    await request<{ success: boolean }>(
      this.opts.url,
      `/api/v1/files/multipart/${encodeURIComponent(fileId)}/abort`,
      { method: "POST", headers: this.auth.authHeader() }
    );
  }
}
