import { z } from "zod";
import { defineRoute } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireSdkAuth } from "@/shared/iam";
import { RealtimeService } from "@/modules/realtime";
import { ApiError } from "@/shared/errors";

const body = z.object({
  channel: z.string().min(1).max(200),
  event: z.string().min(1).max(100).default("broadcast"),
  payload: z.unknown().optional()
});

export const POST = withCors(
  "app-domain",
  defineRoute({
    schema: { body },
    handler: async ({ body: b }, { req }) => {
      const auth = await requireSdkAuth(req);
      const result = RealtimeService.broadcast(
        auth.app.id,
        b.channel,
        b.event,
        b.payload ?? null
      );
      if (!result.channel) throw new ApiError("DATA_QUERY_INVALID", { message: "validation.channelInvalid" });
      return result;
    }
  })
);

export const OPTIONS = withCors("app-domain", async () => new Response(null, { status: 204 }));