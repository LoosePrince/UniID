/**
 * GET /api/v1/realtime/stream?app_id=...&channels=a,b,c
 *
 * 单实例 SSE 通道。Client：EventSource。
 * 鉴权：必须有 SDK access token + Origin ∈ app.domains。
 */
import type { NextRequest } from "next/server";
import { withCors } from "@/shared/cors";
import { requireSdkAuth } from "@/shared/iam";
import { RealtimeService, normalizeRealtimeChannels, type Subscriber } from "@/modules/realtime";
import { randomUUID } from "node:crypto";
import { ApiError, toErrorResponse } from "@/shared/errors";
import { getSystemConfig } from "@/shared/system-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function handler(req: NextRequest): Promise<Response> {
  try {
    const auth = await requireSdkAuth(req);
    const systemConfig = await getSystemConfig();
    RealtimeService.configure(systemConfig);
    if (!systemConfig.realtimeEnabled) throw new ApiError("REALTIME_DISABLED");
    const requestedChannels = (req.nextUrl.searchParams.get("channels") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const channels = normalizeRealtimeChannels(auth.app.id, requestedChannels);
    const lastEventId = req.headers.get("last-event-id") ?? req.nextUrl.searchParams.get("last_event_id");

    if (channels.length === 0) {
      throw new ApiError("DATA_QUERY_INVALID", { details: { hint: "channels required" } });
    }

    const encoder = new TextEncoder();
    const keepaliveSec = systemConfig.realtimeKeepaliveSeconds;

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
        function send(event: string, data: unknown, id?: string) {
          if (id) write(`id: ${id}\n`);
          write(`event: ${event}\n`);
          write(`data: ${JSON.stringify(data)}\n\n`);
        }

        send("ready", { connectionId: randomUUID(), channels, at: Date.now() });

        subscriber = {
          id: randomUUID(),
          appId: auth.app.id,
          userId: auth.user.id,
          role: auth.user.role,
          systemAdmin: auth.user.role === "admin",
          appAdmin: false,
          authType: auth.session.authType,
          origin: "sdk",
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
        void RealtimeService.replay(subscriber, lastEventId)
          .then((result) => {
            if (result.missed) send("replay-missed", { lastEventId, at: Date.now() });
          })
          .catch(() => {});

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
    return await toErrorResponse(err, undefined, req);
  }
}

export const GET = withCors("app-domain", handler);
export const OPTIONS = withCors("app-domain", async () => new Response(null, { status: 204 }));
