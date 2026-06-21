import { z } from "zod";
import { defineRoute, idSchema } from "@/shared/http";
import { withCors } from "@/shared/cors";
import { requireAppAccess } from "@/shared/iam";
import { RealtimeService } from "@/modules/realtime";
import { ApiError } from "@/shared/errors";
import { getSystemConfig } from "@/shared/system-config";

const params = z.object({ appId: idSchema });
const body = z.object({
  channel: z.string().min(1).max(200),
  event: z.string().min(1).max(100).default("broadcast"),
  payload: z.unknown().optional()
});

export const POST = withCors(
  "admin-only",
  defineRoute({
    schema: { params, body },
    handler: async ({ params: p, body: b }) => {
      await requireAppAccess(p.appId);
      const systemConfig = await getSystemConfig();
      RealtimeService.configure(systemConfig);
      if (!systemConfig.realtimeEnabled) throw new ApiError("REALTIME_DISABLED");
      const result = RealtimeService.broadcast(p.appId, b.channel, b.event, b.payload ?? null);
      if (!result.channel) throw new ApiError("DATA_QUERY_INVALID", { message: "validation.channelInvalid" });
      return result;
    }
  })
);

export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));
