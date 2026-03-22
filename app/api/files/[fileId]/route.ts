import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContextFromRequest } from "@/lib/auth-context";
import { canDeleteFile } from "@/lib/file-permissions";
import { deleteObject } from "@/lib/object-storage";

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "DELETE,OPTIONS",
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

export async function DELETE(
  req: NextRequest,
  context: { params: { fileId: string } }
) {
  const auth = await getAuthContextFromRequest(req);
  if (!auth.ok) {
    return json(req, { error: auth.error }, { status: auth.status });
  }

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

  if (!(await canDeleteFile(file, auth.user))) {
    return json(req, { error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    await deleteObject(file.objectKey);
    const now = Math.floor(Date.now() / 1000);
    await prisma.$transaction([
      prisma.fileObject.update({
        where: { id: file.id },
        data: {
          deleted: 1,
          updatedAt: now
        }
      }),
      prisma.fileShareToken.updateMany({
        where: {
          fileId: file.id,
          revoked: 0
        },
        data: {
          revoked: 1
        }
      })
    ]);

    return json(req, { success: true });
  } catch {
    return json(req, { error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
