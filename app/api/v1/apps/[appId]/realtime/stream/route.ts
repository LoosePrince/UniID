import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withCors } from "@/shared/cors";
import { idSchema } from "@/shared/http";
import { requireAppAccess } from "@/shared/iam";
import { ApiError, toErrorResponse } from "@/shared/errors";
import { config } from "@/shared/config";
import { RealtimeService, normalizeRealtimeChannels, type Subscriber } from "@/modules/realtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const paramsSchema = z.object({ appId: idSchema });

async function handler(req: NextRequest, ctx: { params: Record<string, string | string[]> }): Promise<Response> {
  try {
    const params = paramsSchema.parse(ctx.params);
    const auth = await requireAppAccess(params.appId);
    const requestedChannels = (req.nextUrl.searchParams.get("channels") || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const channels = normalizeRealtimeChannels(params.appId, requestedChannels);

    if (channels.length === 0) {
      throw new ApiError("DATA_QUERY_INVALID", { details: { hint: "channels required" } });
    }

    const encoder = new TextEncoder();
    const keepaliveSec = config().REALTIME_KEEPALIVE_SECONDS;
    let subscriber: Subscriber | null = null;
    let keepaliveTimer: ReturnType<typeof setInterval> | null = null;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        function write(chunk: string) {
          try {
            controller.enqueue(encoder.encode(chunk));
          } catch {
            // closed
          }
        }

        function send(event: string, data: unknown) {
          write(`event: ${event}\n`);
          write(`data: ${JSON.stringify(data)}\n\n`);
        }

        send("ready", { connectionId: randomUUID(), channels, at: Date.now() });

        subscriber = {
          id: randomUUID(),
          appId: params.appId,
          userId: auth.user.id,
          channels: new Set(channels),
          send,
          close: () => {
            try {
              controller.close();
            } catch {
              // already closed
            }
          }
        };
        RealtimeService.addSubscriber(subscriber);

        keepaliveTimer = setInterval(() => {
          write(`: ping ${Date.now()}\n\n`);
        }, keepaliveSec * 1000);
      },
      cancel() {
        if (subscriber) RealtimeService.removeSubscriber(subscriber);
        if (keepaliveTimer) clearInterval(keepaliveTimer);
      }
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no"
      }
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export const GET = withCors("admin-only", handler);
export const OPTIONS = withCors("admin-only", async () => new Response(null, { status: 204 }));