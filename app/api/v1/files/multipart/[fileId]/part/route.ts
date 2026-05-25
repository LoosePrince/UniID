/**
 * POST /api/v1/files/multipart/[fileId]/part?partNumber=N
 *
 * Body: 原始字节（application/octet-stream），单分片建议 5MB ~ 50MB。
 */
import { withCors } from "@/shared/cors";
import { requireSdkAuth } from "@/shared/iam";
import { ApiError, toErrorResponse } from "@/shared/errors";
import { FileService } from "@/modules/files";
import { type NextRequest, NextResponse } from "next/server";

async function handler(
  req: NextRequest,
  ctx: { params: Record<string, string | string[]> }
): Promise<Response> {
  try {
    const auth = await requireSdkAuth(req);
    const fileId = String(ctx.params.fileId);
    const partNumberRaw = req.nextUrl.searchParams.get("partNumber");
    const partNumber = Number(partNumberRaw);
    if (!Number.isInteger(partNumber) || partNumber < 1) {
      throw new ApiError("FILE_MULTIPART_INVALID", { message: "partNumber 必须为正整数" });
    }
    const buf = Buffer.from(await req.arrayBuffer());
    if (buf.byteLength === 0) {
      throw new ApiError("FILE_MULTIPART_INVALID", { message: "分片为空" });
    }
    const result = await FileService.uploadPart({
      fileId,
      partNumber,
      body: buf,
      actorId: auth.user.id
    });
    return NextResponse.json({ part: result });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export const POST = withCors("app-domain", handler);
export const OPTIONS = withCors("app-domain", async () => new Response(null, { status: 204 }));
