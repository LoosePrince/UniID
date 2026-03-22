import { canUseShareToken } from "@/lib/file-permissions";
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
  context: { params: { token: string } }
) {
  if (!(await canUseShareToken())) {
    return json(req, { error: "SHARE_TOKEN_DISABLED" }, { status: 403 });
  }

  const { token } = context.params;
  const now = Math.floor(Date.now() / 1000);
  const share = await prisma.fileShareToken.findFirst({
    where: {
      token,
      revoked: 0,
      expiresAt: {
        gt: now
      }
    },
    include: {
      file: true
    }
  });

  if (!share || share.file.deleted === 1) {
    return json(req, { error: "INVALID_OR_EXPIRED_TOKEN" }, { status: 404 });
  }

  return json(req, {
    fileId: share.file.id,
    originalName: share.file.originalName,
    mimeType: share.file.mimeType,
    size: share.file.size,
    downloadUrl: buildProxyFilePath(share.file.objectKey, {
      shareToken: token
    }),
    expiresAt: share.expiresAt
  });
}
