import { z } from "zod";
import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireConsoleAuth } from "@/shared/iam";
import { prisma } from "@/shared/prisma";

const profileBody = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "validation.displayNameRequired")
    .max(64, "validation.displayNameMax"),
  email: z.union([z.string().trim().email("validation.emailInvalid"), z.literal("")]).optional(),
  locale: z.string().trim().min(2).max(16).optional()
});

const now = () => Math.floor(Date.now() / 1000);

export const PUT = withCors(
  "admin-only",
  defineRoute({
    schema: { body: profileBody },
    handler: async ({ body }) => {
      const auth = await requireConsoleAuth();
      const current = await prisma.user.findUnique({
        where: { id: auth.user.id },
        select: { email: true }
      });
      const nextEmail = body.email ? body.email : null;
      const user = await prisma.user.update({
        where: { id: auth.user.id },
        data: {
          displayName: body.displayName,
          email: nextEmail,
          emailVerifiedAt: current?.email === nextEmail ? undefined : null,
          locale: body.locale ?? "zh-CN",
          updatedAt: now()
        },
        select: {
          id: true,
          username: true,
          email: true,
          displayName: true,
          locale: true,
          role: true,
          updatedAt: true
        }
      });

      return { user };
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
