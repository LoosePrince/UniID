import { z } from "zod";
import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { AppDatabaseService, bearerToken, clientIp } from "@/modules/app-databases";

const statement = z.object({
  sql: z.string().min(1).max(200_000),
  params: z.union([z.array(z.unknown()), z.record(z.unknown())]).optional(),
  mode: z.enum(["auto", "read", "write"]).optional()
});
const bodySchema = z.object({ statements: z.array(statement).min(1).max(100) });

export const POST = withCors(
  "public",
  defineRoute({
    schema: { body: bodySchema },
    handler: async ({ body }, ctx) => {
      const auth = await AppDatabaseService.authenticateBearer(bearerToken(ctx.req), { ip: clientIp(ctx.req) });
      return AppDatabaseService.executeAuthenticatedTransaction(auth, {
        statements: body.statements
      });
    }
  })
);

export const OPTIONS = withCors("public", async () => new Response(null, { status: 204 }));
