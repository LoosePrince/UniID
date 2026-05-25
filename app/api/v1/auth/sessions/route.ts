import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireConsoleAuth, revokeUserSession } from "@/shared/iam";
import { AuthService } from "@/modules/auth";
import { prisma } from "@/shared/prisma";
import { ApiError } from "@/shared/errors";

export const GET = withCors(
  "admin-only",
  defineRoute({
    handler: async () => {
      const auth = await requireConsoleAuth();
      const [consoleSessions, appSessions, authorizations] = await Promise.all([
        AuthService.listConsoleSessions(auth.user.id),
        AuthService.listAppSessions(auth.user.id),
        AuthService.listAuthorizations(auth.user.id)
      ]);
      return { consoleSessions, appSessions, authorizations };
    }
  })
);

const deleteQuery = z.object({
  sessionId: idSchema,
  kind: z.enum(["user", "app"]).default("user")
});

export const DELETE = withCors(
  "admin-only",
  defineRoute({
    schema: { query: deleteQuery },
    handler: async ({ query }) => {
      const auth = await requireConsoleAuth();
      const { sessionId, kind } = query!;

      if (kind === "user") {
        const session = await prisma.userSession.findUnique({ where: { id: sessionId } });
        if (!session || session.userId !== auth.user.id) {
          throw new ApiError("AUTH_SESSION_NOT_FOUND");
        }
        await revokeUserSession(sessionId);
      } else {
        const session = await prisma.appSession.findUnique({ where: { id: sessionId } });
        if (!session || session.userId !== auth.user.id) {
          throw new ApiError("AUTH_SESSION_NOT_FOUND");
        }
        await AuthService.revokeBySessionId(sessionId);
      }
      return { success: true };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
