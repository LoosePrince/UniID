import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { ApiError, toErrorResponse } from "@/shared/errors";
import { FileService } from "@/modules/files";

const uploadSchema = z.object({
  visibility: z.enum(["private", "public"]).default("private")
});

export const POST = withCors("admin-only", async (req: NextRequest, ctx) => {
  try {
    const auth = await requireAppAccess(String(ctx.params.appId));
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new ApiError("FILE_MULTIPART_INVALID");
    }

    const parsed = uploadSchema.parse({ visibility: form.get("visibility") ?? "private" });
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await FileService.upload({
      file: {
        buffer,
        mimeType: file.type || "application/octet-stream",
        originalName: file.name
      },
      ownerId: auth.user.id,
      appId: auth.app.id,
      visibility: parsed.visibility
    });

    return NextResponse.json({ file: result });
  } catch (err) {
    return await toErrorResponse(err, undefined, req);
  }
});

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));