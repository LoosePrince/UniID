import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContextFromRequest } from "@/lib/auth-context";
import { isSystemAdmin } from "@/lib/permissions";

/**
 * 获取所有应用 (仅系统管理员)
 */
export async function GET(req: NextRequest) {
  const auth = await getAuthContextFromRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!(await isSystemAdmin(auth.user.id))) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const apps = await prisma.app.findMany({
    include: {
      owner: {
        select: {
          id: true,
          username: true,
          email: true,
        },
      },
      admins: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(apps);
}

/**
 * 创建新应用 (仅系统管理员)
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
    const { name, domain, description, ownerId } = body;

    if (!name || !domain || !ownerId) {
      return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
    }

    const app = await prisma.app.create({
      data: {
        name,
        domain,
        description,
        ownerId,
        createdAt: Math.floor(Date.now() / 1000),
        status: "active",
      },
    });

    return NextResponse.json(app);
  } catch (err: any) {
    if (err.code === "P2002") {
      return NextResponse.json({ error: "DOMAIN_TAKEN" }, { status: 409 });
    }
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
