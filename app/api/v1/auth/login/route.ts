import { z } from "zod";
import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { AuthService } from "@/modules/auth";
import { createUserSession, setSessionCookie } from "@/shared/iam";
import { passwordSchema, usernameSchema } from "@/shared/http";
import { bus } from "@/shared/bus";

const bodySchema = z.object({
  username: usernameSchema,
  password: passwordSchema
});

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { body: bodySchema },
    handler: async ({ body }, { req }) => {
      const user = await AuthService.login(body.username, body.password);
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
      const ua = req.headers.get("user-agent");

      const { token, sessionId } = await createUserSession({
        userId: user.id,
        username: user.username,
        role: user.role,
        ip,
        userAgent: ua
      });
      setSessionCookie(token);

      bus.emit("auth.login", {
        userId: user.id,
        sessionId,
        ip,
        at: Math.floor(Date.now() / 1000)
      });

      return {
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          email: user.email,
          displayName: user.displayName
        }
      };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
