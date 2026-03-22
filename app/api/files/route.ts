import { getAuthContextFromRequest } from "@/lib/auth-context";
import { canManageAllFiles } from "@/lib/file-permissions";
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

type FileListItem = {
  id: string;
  appId: string | null;
  ownerId: string;
  objectKey: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: number;
  owner: { id: string; username: string };
};

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: NextRequest) {
  const auth = await getAuthContextFromRequest(req);
  if (!auth.ok) {
    return json(req, { error: auth.error }, { status: auth.status });
  }

  const scope = req.nextUrl.searchParams.get("scope") === "all" ? "all" : "own";
  const isManager = await canManageAllFiles(auth.user.id);
  const canQueryAll = scope === "all" && isManager;

  const client = prisma as unknown as {
    fileObject: {
      findMany: (args: Record<string, unknown>) => Promise<FileListItem[]>;
    };
  };

  const files = await client.fileObject.findMany({
    where: {
      deleted: 0,
      ...(canQueryAll ? {} : { ownerId: auth.user.id })
    },
    orderBy: {
      createdAt: "desc"
    },
    include: {
      owner: {
        select: {
          id: true,
          username: true
        }
      }
    },
    take: 200
  });

  return json(req, {
    scope: canQueryAll ? "all" : "own",
    items: files.map((file: FileListItem) => ({
      id: file.id,
      ownerId: file.ownerId,
      ownerName: file.owner.username,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      createdAt: file.createdAt,
      downloadUrl: buildProxyFilePath(file.objectKey)
    }))
  });
}
