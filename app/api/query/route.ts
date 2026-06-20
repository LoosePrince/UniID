import { z } from "zod";
import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { AppDatabaseService, bearerToken, clientIp } from "@/modules/app-databases";

const bodySchema = z.object({
  sql: z.string().min(1).max(200_000),
  params: z.union([z.array(z.unknown()), z.record(z.unknown())]).optional(),
  mode: z.enum(["auto", "read", "write"]).optional()
});

export const POST = withCors(
  "public",
  defineRoute({
    schema: { body: bodySchema },
    handler: async ({ body }, ctx) => {
      const auth = await AppDatabaseService.authenticateBearer(bearerToken(ctx.req), { ip: clientIp(ctx.req) });
      return AppDatabaseService.executeAuthenticatedQuery(auth, {
        sql: body.sql,
        params: body.params,
        mode: body.mode
      });
    }
  })
);

export const OPTIONS = withCors("public", async () => new Response(null, { status: 204 }));
