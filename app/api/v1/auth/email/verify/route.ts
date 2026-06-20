import { z } from "zod";
import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { AuthService } from "@/modules/auth";

const querySchema = z.object({
  token: z.string().min(16)
});

const bodySchema = z.object({
  token: z.string().min(16)
});

export const GET = withCors(
  "admin-only",
  defineRoute({
    schema: { query: querySchema },
    handler: async ({ query }) => AuthService.verifyEmail(query.token)
  })
);

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { body: bodySchema },
    handler: async ({ body }) => AuthService.verifyEmail(body.token)
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
