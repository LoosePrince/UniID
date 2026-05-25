import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { clearSessionCookie, getCurrentUserSession, revokeUserSession } from "@/shared/iam";
import { bus } from "@/shared/bus";

export const POST = withCors(
  "admin-only",
  defineRoute({
    handler: async () => {
      const session = await getCurrentUserSession();
      if (session) {
        await revokeUserSession(session.sessionId);
        bus.emit("auth.logout", {
          userId: session.userId,
          sessionId: session.sessionId,
          at: Math.floor(Date.now() / 1000)
        });
      }
      clearSessionCookie();
      return { success: true };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
