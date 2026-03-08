import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContextFromRequest } from "@/lib/auth-context";
import { isSystemAdmin } from "@/lib/permissions";

/**
 * 获取所有用户 (仅系统管理员)
 */
export async function GET(req: NextRequest) {
  const auth = await getAuthContextFromRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!(await isSystemAdmin(auth.user.id))) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      deleted: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(users);
}

/**
 * 创建新用户 (仅系统管理员)
 */
export async function POST(req: NextRequest) {
  const auth = await getAuthContextFromRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!(await isSystemAdmin(auth.user.id))) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { username, password, email, role } = body;

    if (!username || !password) {
      return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
    }

    const { hash } = await import("bcryptjs");
    const passwordHash = await hash(password, 10);
    const now = Math.floor(Date.now() / 1000);

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        email,
        role: role || "user",
        createdAt: now,
        updatedAt: now,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
      },
    });

    return NextResponse.json(user);
  } catch (err: any) {
    if (err.code === "P2002") {
      return NextResponse.json({ error: "USERNAME_TAKEN" }, { status: 409 });
    }
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
