import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

type DataApiHandler<TParams extends Record<string, string> = Record<string, string>> = (
  req: NextRequest,
  context: { params: TParams }
) => Promise<NextResponse>;

const isDev = process.env.NODE_ENV !== "production";

function isLocalOrigin(origin: string | null): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1"
    );
  } catch {
    return false;
  }
}

export async function resolveAllowedOrigin(
  origin: string | null
): Promise<string | null> {
  if (!origin) return null;

  if (isDev && isLocalOrigin(origin)) {
    return origin;
  }

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

export function setCorsHeaders(
  res: NextResponse,
  allowedOrigin: string | null
): void {
  if (!allowedOrigin) return;
  res.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  res.headers.set("Vary", "Origin");
  res.headers.set("Access-Control-Allow-Credentials", "true");
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

export function withDataCors<TParams extends Record<string, string> = Record<string, string>>(
  handler: DataApiHandler<TParams>
) {
  return async function wrapped(
    req: NextRequest,
    context: { params: TParams }
  ): Promise<NextResponse> {
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

    const res = await handler(req, context);
    res.headers.set("Access-Control-Allow-Origin", allowedOrigin);
    res.headers.set("Vary", "Origin");
    res.headers.set("Access-Control-Allow-Credentials", "true");
    return res;
  };
}

