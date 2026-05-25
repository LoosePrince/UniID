/**
 * POST /api/v1/files/upload
 *
 * 接受 multipart/form-data；字段：
 *   - file        : File (必须)
 *   - visibility  : "private" | "public" (可选)
 */
import { withCors } from "@/shared/cors";
import { requireSdkAuth } from "@/shared/iam";
import { ApiError, toErrorResponse } from "@/shared/errors";
import { FileService } from "@/modules/files";
import { NextResponse, type NextRequest } from "next/server";

async function handler(req: NextRequest): Promise<Response> {
  try {
    const auth = await requireSdkAuth(req);
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new ApiError("FILE_MULTIPART_INVALID");
    }
    const visibility = (form.get("visibility") as string) === "public" ? "public" : "private";
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await FileService.upload({
      file: { buffer, mimeType: file.type || "application/octet-stream", originalName: file.name },
      ownerId: auth.user.id,
      appId: auth.app.id,
      visibility
    });
    return NextResponse.json({ file: result });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export const POST = withCors("app-domain", handler);
export const OPTIONS = withCors("app-domain", async () => new Response(null, { status: 204 }));
