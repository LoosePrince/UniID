import { getAuthContextFromRequest } from "@/lib/auth-context";
import { canDownloadFile } from "@/lib/file-permissions";
import { buildProxyFilePath } from "@/lib/file-public-path";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
    Vary: "Origin"
  };
}

function json(req: NextRequest, body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...corsHeaders(req),
      ...(init?.headers ?? {})
    }
  });
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(
  req: NextRequest,
  context: { params: { fileId: string } }
) {
  const { fileId } = context.params;
  const file = await prisma.fileObject.findFirst({
    where: {
      id: fileId,
      deleted: 0
    }
  });

  if (!file) {
    return json(req, { error: "FILE_NOT_FOUND" }, { status: 404 });
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
      return json(req, { error: "INVALID_SHARE_TOKEN" }, { status: 403 });
    }

    return json(req, {
      fileId: file.id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      downloadUrl: buildProxyFilePath(file.objectKey, {
        shareToken
      }),
      via: "share_token"
    });
  }

  const auth = await getAuthContextFromRequest(req);
  if (!auth.ok) {
    return json(req, { error: auth.error }, { status: auth.status });
  }

  if (!(await canDownloadFile(file, auth.user))) {
    return json(req, { error: "FORBIDDEN" }, { status: 403 });
  }

  return json(req, {
    fileId: file.id,
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: file.size,
    downloadUrl: buildProxyFilePath(file.objectKey),
    via: "auth"
  });
}
