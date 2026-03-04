import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { isSameOriginAuthRequest } from "@/lib/origin";

export async function GET(req: NextRequest) {
  if (!isSameOriginAuthRequest(req)) {
    return NextResponse.json({ valid: false }, { status: 403 });
  }

  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ valid: false }, { status: 401 });
  }

  const token = authHeader.slice("Bearer ".length).trim();

  try {
    const payload = await verifyToken(token);

    const userId = payload.sub as string;

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || user.deleted === 1) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    return NextResponse.json({
      valid: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      },
      app_id: (payload as any).app_id ?? null,
      auth_type: (payload as any).auth_type ?? "full"
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ valid: false }, { status: 401 });
  }
}

