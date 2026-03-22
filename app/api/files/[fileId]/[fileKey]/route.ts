import { parseFileIdFromFileKey } from "@/lib/file-public-path";
import { corsHeaders, executeFileDownloadGet } from "@/lib/file-download-get";
import { NextRequest, NextResponse } from "next/server";

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

/**
 * 对外文件 URL：`GET /api/files/{appId}/{fileId}.png`
 * Next 路由参数首段名为 `[fileId]`，语义为 **应用命名空间**（FileObject.appId）。
 */
export async function GET(
  req: NextRequest,
  context: { params: { fileId: string; fileKey: string } }
) {
  const pathAppId = context.params.fileId;
  const { fileKey } = context.params;
  const id = parseFileIdFromFileKey(fileKey);

  return executeFileDownloadGet(req, id, { pathAppId });
}
