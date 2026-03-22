import { getAuthContextFromRequest } from "@/lib/auth-context";
import { canDownloadFile } from "@/lib/file-permissions";
import {
  getObjectStreamFromStorage,
  getPresignedGetObjectUrl
} from "@/lib/object-storage";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
    Vary: "Origin"
  };
}

function withCors(req: NextRequest, headers: Headers): Headers {
  const merged = new Headers(headers);
  for (const [k, v] of Object.entries(corsHeaders(req))) {
    merged.set(k, v);
  }
  return merged;
}

function contentDisposition(
  filename: string,
  disposition: "inline" | "attachment"
): string {
  const safe = filename.replace(/[\r\n"]/g, "_");
  const encoded = encodeURIComponent(filename);
  return `${disposition}; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

export type FileDownloadGetOptions = {
  /** 来自 `/api/files/{ownerId}/{yyyy}/{mm}/...` 的完整 objectKey，须与库内 FileObject.objectKey 一致 */
  pathObjectKey?: string;
};

/**
 * 统一的文件 GET：鉴权 → 预签名 302 或 ?proxy=1 流式代理
 */
export async function executeFileDownloadGet(
  req: NextRequest,
  fileId: string,
  options?: FileDownloadGetOptions
): Promise<NextResponse> {
  const file = await prisma.fileObject.findFirst({
    where: {
      id: fileId,
      deleted: 0
    }
  });

  if (!file) {
    return NextResponse.json(
      { error: "FILE_NOT_FOUND" },
      { status: 404, headers: corsHeaders(req) }
    );
  }

  if (
    options?.pathObjectKey != null &&
    file.objectKey !== options.pathObjectKey
  ) {
    return NextResponse.json(
      { error: "FILE_NOT_FOUND" },
      { status: 404, headers: corsHeaders(req) }
    );
  }

  const shareToken = req.nextUrl.searchParams.get("share_token");
  const now = Math.floor(Date.now() / 1000);

  if (shareToken) {
    const token = await prisma.fileShareToken.findFirst({
      where: {
        fileId: file.id,
        token: shareToken,
        revoked: 0,
        expiresAt: {
          gt: now
        }
      }
    });

    if (!token) {
      return NextResponse.json(
        { error: "INVALID_SHARE_TOKEN" },
        { status: 403, headers: corsHeaders(req) }
      );
    }
  } else {
    const auth = await getAuthContextFromRequest(req);
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status, headers: corsHeaders(req) }
      );
    }
    if (!(await canDownloadFile(file, auth.user))) {
      return NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403, headers: corsHeaders(req) }
      );
    }
  }

  const useProxy = req.nextUrl.searchParams.get("proxy") === "1";
  const forceDownload = req.nextUrl.searchParams.get("download") === "1";
  const disposition: "inline" | "attachment" = forceDownload
    ? "attachment"
    : "inline";

  try {
    if (!useProxy) {
      const signed = await getPresignedGetObjectUrl({
        objectKey: file.objectKey,
        inlineFilename: file.originalName,
        disposition
      });
      return NextResponse.redirect(signed, {
        status: 302,
        headers: corsHeaders(req)
      });
    }

    const { body, contentType, contentLength } = await getObjectStreamFromStorage(
      file.objectKey
    );
    const headers = new Headers();
    headers.set("Content-Type", file.mimeType || contentType);
    if (typeof contentLength === "number") {
      headers.set("Content-Length", String(contentLength));
    }
    headers.set(
      "Content-Disposition",
      contentDisposition(file.originalName, disposition)
    );

    return new NextResponse(body, {
      status: 200,
      headers: withCors(req, headers)
    });
  } catch (error) {
    console.error(useProxy ? "FILE_PROXY_STREAM_FAILED" : "FILE_PRESIGN_REDIRECT_FAILED", error);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500, headers: corsHeaders(req) }
    );
  }
}
