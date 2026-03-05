import { getAuthContextFromRequest } from "@/lib/auth-context";
import { isSameOriginAuthRequest } from "@/lib/origin";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  if (!isSameOriginAuthRequest(req)) {
    return NextResponse.json({ valid: false }, { status: 403 });
  }

  const auth = await getAuthContextFromRequest(req);

  if (!auth.ok) {
    return NextResponse.json({ valid: false }, { status: auth.status });
  }

  const payload = auth.payload as any;

  return NextResponse.json({
    valid: true,
    user: {
      id: auth.user.id,
      username: auth.user.username,
      role: auth.user.role
    },
    app_id: payload.app_id ?? null,
    auth_type: payload.auth_type ?? "full"
  });
}

