import { objectKeyFromPublicPathSegments } from "@/lib/file-public-path";
import { corsHeaders, executeFileDownloadGet } from "@/lib/file-download-get";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

/**
 * 对外文件 URL：`GET /api/files/{ownerId}/{yyyy}/{mm}/{fileNamePart}`
 * 与对象存储 Key `files/{ownerId}/{yyyy}/{mm}/{fileNamePart}` 一致。
 * 路由首段参数名为 `[fileId]`（与 `/api/files/[fileId]` 同层 slug 要求），语义为 **ownerId**。
 */
export async function GET(
  req: NextRequest,
  context: {
    params: { fileId: string; year: string; month: string; filename: string };
  }
) {
  const { fileId: ownerId, year, month, filename } = context.params;
  const objectKey = objectKeyFromPublicPathSegments({
    ownerId,
    year,
    month,
    filename
  });

  const row = await prisma.fileObject.findFirst({
    where: {
      objectKey,
      deleted: 0
    },
    select: { id: true }
  });

  if (!row) {
    return NextResponse.json(
      { error: "FILE_NOT_FOUND" },
      { status: 404, headers: corsHeaders(req) }
    );
  }

  return executeFileDownloadGet(req, row.id, { pathObjectKey: objectKey });
}
