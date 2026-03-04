import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type DataApiHandler = (req: NextRequest) => Promise<NextResponse>;

async function resolveAllowedOrigin(origin: string | null): Promise<string | null> {
  if (!origin) return null;
  try {
    const url = new URL(origin);
    const host = url.host;

    const app = await prisma.app.findFirst({
      where: { domain: host }
    });

    if (!app) {
      return null;
    }

    return origin;
  } catch {
    return null;
  }
}

export async function handleDataApiOptions(
  req: NextRequest
): Promise<NextResponse> {
  const origin = req.headers.get("origin") ?? req.headers.get("Origin");
  const allowedOrigin = await resolveAllowedOrigin(origin);

  if (!allowedOrigin) {
    return new NextResponse(null, { status: 403 });
  }

  const res = new NextResponse(null, { status: 204 });
  res.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  res.headers.set("Vary", "Origin");
  res.headers.set("Access-Control-Allow-Credentials", "true");
  res.headers.set(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type"
  );
  res.headers.set(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  return res;
}

export function withDataCors(handler: DataApiHandler) {
  return async function wrapped(req: NextRequest): Promise<NextResponse> {
    if (req.method === "OPTIONS") {
      return handleDataApiOptions(req);
    }

    const origin = req.headers.get("origin") ?? req.headers.get("Origin");
    const allowedOrigin = await resolveAllowedOrigin(origin);

    if (!allowedOrigin) {
      return NextResponse.json(
        { error: "CORS_ORIGIN_FORBIDDEN" },
        { status: 403 }
      );
    }

    const res = await handler(req);
    res.headers.set("Access-Control-Allow-Origin", allowedOrigin);
    res.headers.set("Vary", "Origin");
    res.headers.set("Access-Control-Allow-Credentials", "true");
    return res;
  };
}

