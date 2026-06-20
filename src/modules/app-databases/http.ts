import type { NextRequest } from "next/server";
import { ApiError } from "@/shared/errors";

export function bearerToken(req: NextRequest): string {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) throw new ApiError("AUTH_INVALID_TOKEN");
  const token = auth.slice("Bearer ".length).trim();
  if (!token) throw new ApiError("AUTH_INVALID_TOKEN");
  return token;
}

export function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}

