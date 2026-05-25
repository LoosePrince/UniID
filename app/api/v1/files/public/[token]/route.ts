/**
 * GET /api/v1/files/public/[token]
 *
 * 公开下载入口（302 → presigned S3 URL）。无需登录。
 */
import { z } from "zod";
import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { FileService } from "@/modules/files";
import { NextResponse } from "next/server";

const params = z.object({ token: z.string().min(8).max(128) });

export const GET = withCors(
  "public",
  defineRoute({
    schema: { params },
    handler: async ({ params: p }) => {
      const url = await FileService.resolveShareToken(p.token);
      return NextResponse.redirect(url, 302);
    }
  })
);

export const OPTIONS = withCors("public", async () => new Response(null, { status: 204 }));
