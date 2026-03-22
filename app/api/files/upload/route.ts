import { getAuthContextFromRequest } from "@/lib/auth-context";
import { canUpload } from "@/lib/file-permissions";
import { buildProxyFilePath } from "@/lib/file-public-path";
import {
  createObjectKey,
  getObjectStorageBucket,
  sha256Hex,
  uploadObject
} from "@/lib/object-storage";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
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

function getMaxFileSizeBytes(): number {
  const raw = process.env.FILE_MAX_SIZE_BYTES?.trim();
  const parsed = raw ? Number(raw) : 10 * 1024 * 1024;
  if (!Number.isFinite(parsed) || parsed <= 0) return 10 * 1024 * 1024;
  return Math.floor(parsed);
}

function isAllowedMimeType(mimeType: string): boolean {
  const raw = process.env.FILE_ALLOWED_MIME_TYPES?.trim();
  if (!raw || raw === "*") return true;
  const allowed = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return allowed.includes(mimeType);
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthContextFromRequest(req);
  if (!auth.ok) {
    return json(req, { error: auth.error }, { status: auth.status });
  }

  if (!(await canUpload(auth.user))) {
    return json(req, { error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const client = prisma as unknown as {
      fileObject: {
        create: (args: {
          data: {
            ownerId: string;
            appId: string | null;
            bucket: string;
            objectKey: string;
            originalName: string;
            mimeType: string;
            size: number;
            checksum: string;
            visibility: string;
            createdAt: number;
            updatedAt: number;
          };
        }) => Promise<{
          id: string;
          appId: string | null;
          originalName: string;
          mimeType: string;
          size: number;
          createdAt: number;
          objectKey: string;
        }>;
      };
    };

    const formData = await req.formData();
    const appIdRaw = formData.get("appId");
    const appId =
      typeof appIdRaw === "string" && appIdRaw.trim() !== ""
        ? appIdRaw.trim()
        : null;

    const inputFile = formData.get("file");
    if (!(inputFile instanceof File)) {
      return json(req, { error: "FILE_REQUIRED" }, { status: 400 });
    }

    if (inputFile.size <= 0) {
      return json(req, { error: "EMPTY_FILE" }, { status: 400 });
    }

    const maxSize = getMaxFileSizeBytes();
    if (inputFile.size > maxSize) {
      return json(req, { error: "FILE_TOO_LARGE" }, { status: 400 });
    }

    if (!isAllowedMimeType(inputFile.type)) {
      return json(req, { error: "MIME_TYPE_NOT_ALLOWED" }, { status: 400 });
    }

    const objectKey = createObjectKey(auth.user.id, inputFile.name);
    const buffer = Buffer.from(await inputFile.arrayBuffer());
    const now = Math.floor(Date.now() / 1000);

    await uploadObject({
      objectKey,
      body: buffer,
      contentType: inputFile.type || "application/octet-stream"
    });

    const record = await client.fileObject.create({
      data: {
        ownerId: auth.user.id,
        appId,
        bucket: getObjectStorageBucket(),
        objectKey,
        originalName: inputFile.name,
        mimeType: inputFile.type || "application/octet-stream",
        size: inputFile.size,
        checksum: sha256Hex(buffer),
        visibility: "private",
        createdAt: now,
        updatedAt: now
      }
    });

    return json(req, {
      id: record.id,
      originalName: record.originalName,
      mimeType: record.mimeType,
      size: record.size,
      createdAt: record.createdAt,
      downloadUrl: buildProxyFilePath(record.id, {
        appId: record.appId,
        originalName: record.originalName
      })
    });
  } catch (error) {
    console.error("FILE_UPLOAD_FAILED", error);
    return json(req, { error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
