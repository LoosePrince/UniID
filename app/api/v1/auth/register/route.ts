import { z } from "zod";
import { defineRoute, emailSchema, passwordSchema, usernameSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { AuthService } from "@/modules/auth";
import { createUserSession, setSessionCookie } from "@/shared/iam";

const bodySchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  email: emailSchema,
  displayName: z.string().max(64).optional(),
  emailVerificationCode: z.string().trim().regex(/^\d{6}$/).optional(),
  emailVerificationChallenge: z.string().trim().min(1).optional()
});

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { body: bodySchema },
    handler: async ({ body }, { req }) => {
      const user = await AuthService.register(body);
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
      const ua = req.headers.get("user-agent");
      const { token } = await createUserSession({
        userId: user.id,
        username: user.username,
        role: user.role,
        ip,
        userAgent: ua
      });
      setSessionCookie(token);
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
