import { z } from "zod";
import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { AuthService } from "@/modules/auth";

const bodySchema = z.object({
  refresh_token: z.string().min(1)
});

export const POST = withCors(
  "app-domain",
  defineRoute({
    schema: { body: bodySchema },
    handler: async ({ body }) => {
      const result = await AuthService.refresh(body.refresh_token);
      return {
        token: result.accessToken,
        refresh_token: result.refreshToken,
        expires_in: result.expiresIn
      };
    }
  })
);

export const OPTIONS = withCors("app-domain", async () => new Response(null, { status: 204 }));
