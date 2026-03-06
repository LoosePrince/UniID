import { NextRequest, NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getAuthContextFromRequest } from "@/lib/auth-context";
import { isSameOriginAuthRequest } from "@/lib/origin";

export async function POST(req: NextRequest) {
  if (!isSameOriginAuthRequest(req)) {
    return NextResponse.json(
      { error: "CROSS_ORIGIN_AUTH_FORBIDDEN" },
      { status: 403 }
    );
  }
  const auth = await getAuthContextFromRequest(req);

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      {
        status: auth.status
      }
    );
  }

  const body = await req.json().catch(() => null);
  const { current_password, new_password } = (body ?? {}) as {
    current_password?: string;
    new_password?: string;
  };

  if (!current_password || !new_password) {
    return NextResponse.json(
      { error: "CURRENT_AND_NEW_PASSWORD_REQUIRED" },
      { status: 400 }
    );
  }

  if (new_password.length < 6 || new_password.length > 128) {
    return NextResponse.json(
      { error: "INVALID_NEW_PASSWORD" },
      { status: 400 }
    );
  }

  const user = auth.user;

  const ok = await compare(current_password, user.passwordHash);
  if (!ok) {
    return NextResponse.json(
      { error: "CURRENT_PASSWORD_INCORRECT" },
      { status: 400 }
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const passwordHash = await hash(new_password, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      updatedAt: now
    }
  });

  await prisma.session.updateMany({
    where: {
      userId: user.id,
      token: {
        not: auth.token
      }
    },
    data: {
      expiresAt: now
    }
  });

  return NextResponse.json({ success: true });
}

