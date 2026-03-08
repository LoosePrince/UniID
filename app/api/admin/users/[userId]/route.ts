import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContextFromRequest } from "@/lib/auth-context";
import { isSystemAdmin } from "@/lib/permissions";

/**
 * 更新用户信息 (仅系统管理员)
 */
export async function PATCH(
  req: NextRequest,
  context: { params: { userId: string } }
) {
  const auth = await getAuthContextFromRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!(await isSystemAdmin(auth.user.id))) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { userId } = context.params;

  try {
    const body = await req.json();
    const { role, deleted, email, password } = body;

    const updateData: any = {
      updatedAt: Math.floor(Date.now() / 1000),
    };

    if (role !== undefined) updateData.role = role;
    if (deleted !== undefined) updateData.deleted = deleted ? 1 : 0;
    if (email !== undefined) updateData.email = email;
    
    if (password) {
      const { hash } = await import("bcryptjs");
      updateData.passwordHash = await hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        deleted: true,
      },
    });

    return NextResponse.json(user);
  } catch (err) {
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

/**
 * 删除用户 (仅系统管理员)
 */
export async function DELETE(
  req: NextRequest,
  context: { params: { userId: string } }
) {
  const auth = await getAuthContextFromRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!(await isSystemAdmin(auth.user.id))) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { userId } = context.params;

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { deleted: 1, updatedAt: Math.floor(Date.now() / 1000) },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
