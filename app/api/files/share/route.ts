import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContextFromRequest } from "@/lib/auth-context";
import { buildProxyFilePath } from "@/lib/file-public-path";
import { canManageAllFiles, canUseShareToken } from "@/lib/file-permissions";

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST,DELETE,OPTIONS",
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

function createShareTokenValue(): string {
  return randomBytes(24).toString("base64url");
}

function getDefaultTokenLifetimeSeconds(): number {
  const raw = process.env.FILE_SHARE_TOKEN_EXPIRES_IN_SECONDS?.trim();
  const parsed = raw ? Number(raw) : 7 * 24 * 60 * 60;
  if (!Number.isFinite(parsed) || parsed <= 0) return 7 * 24 * 60 * 60;
  return Math.floor(parsed);
}

function clampTokenLifetime(seconds: number): number {
  const min = 60;
  const max = 30 * 24 * 60 * 60;
  return Math.max(min, Math.min(max, seconds));
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthContextFromRequest(req);
  if (!auth.ok) {
    return json(req, { error: auth.error }, { status: auth.status });
  }

  if (!(await canUseShareToken())) {
    return json(req, { error: "SHARE_TOKEN_DISABLED" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | { fileId?: string; expiresInSeconds?: number }
    | null;

  if (!body?.fileId) {
    return json(req, { error: "FILE_ID_REQUIRED" }, { status: 400 });
  }

  const file = await prisma.fileObject.findFirst({
    where: {
      id: body.fileId,
      deleted: 0
    }
  });
  if (!file) {
    return json(req, { error: "FILE_NOT_FOUND" }, { status: 404 });
  }

  const isOwner = file.ownerId === auth.user.id;
  const isManager = await canManageAllFiles(auth.user.id);
  if (!isOwner && !isManager) {
    return json(req, { error: "FORBIDDEN" }, { status: 403 });
  }

  const now = Math.floor(Date.now() / 1000);
  const requestedLifetime = body.expiresInSeconds ?? getDefaultTokenLifetimeSeconds();
  const expiresAt = now + clampTokenLifetime(requestedLifetime);
  const token = createShareTokenValue();

  const share = await prisma.fileShareToken.create({
    data: {
      fileId: file.id,
      token,
      expiresAt,
      createdById: auth.user.id,
      createdAt: now
    }
  });

  return json(req, {
    fileId: file.id,
    token: share.token,
    expiresAt: share.expiresAt,
    sharePath: buildProxyFilePath(file.id, {
      appId: file.appId,
      originalName: file.originalName,
      shareToken: share.token
    }),
    /** 元数据接口（JSON），不含文件流 */
    publicMetaPath: `/api/files/public/${share.token}`
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await getAuthContextFromRequest(req);
  if (!auth.ok) {
    return json(req, { error: auth.error }, { status: auth.status });
  }

  const body = (await req.json().catch(() => null)) as { token?: string } | null;
  if (!body?.token) {
    return json(req, { error: "TOKEN_REQUIRED" }, { status: 400 });
  }

  const share = await prisma.fileShareToken.findUnique({
    where: { token: body.token },
    include: { file: true }
  });
  if (!share || share.file.deleted === 1) {
    return json(req, { error: "SHARE_TOKEN_NOT_FOUND" }, { status: 404 });
  }

  const isOwner = share.file.ownerId === auth.user.id;
  const isManager = await canManageAllFiles(auth.user.id);
  if (!isOwner && !isManager) {
    return json(req, { error: "FORBIDDEN" }, { status: 403 });
  }

  await prisma.fileShareToken.update({
    where: { token: body.token },
    data: { revoked: 1 }
  });

  return json(req, { success: true });
}
