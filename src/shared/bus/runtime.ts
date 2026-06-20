import { WebhooksService } from "@/modules/webhooks";
import { ensureFunctionEventTriggersBooted } from "@/modules/functions/listener";
import "@/modules/realtime/service";
import { ensureAuditListenersBooted } from "@/shared/audit";
import { logger } from "@/shared/logger";
import { bus } from "./event-bus";

let booted = false;

const OUTBOX_REPLAY_INTERVAL_MS = 15_000;

type OutboxWorkerState = {
  timer: ReturnType<typeof setInterval> | null;
  running: boolean;
};

declare global {
  // eslint-disable-next-line no-var
  var __uniid_event_outbox_worker__: OutboxWorkerState | undefined;
}

const workerState: OutboxWorkerState =
  globalThis.__uniid_event_outbox_worker__ ?? { timer: null, running: false };
globalThis.__uniid_event_outbox_worker__ = workerState;

async function replayOutbox(reason: "boot" | "interval") {
  if (workerState.running) return;
  workerState.running = true;
  try {
    const result = await bus.replay();
    if (result.dispatched > 0 || result.failed > 0) {
      logger.info({ ...result, reason }, "event outbox replay completed");
    }
  } catch (err) {
    logger.error({ err, reason }, "event outbox replay failed");
  } finally {
    workerState.running = false;
  }
}

function startEventOutboxWorker() {
  if (workerState.timer) return;
  workerState.timer = setInterval(() => {
    replayOutbox("interval").catch((err) => logger.error({ err }, "event outbox worker failed"));
  }, OUTBOX_REPLAY_INTERVAL_MS);
  (workerState.timer as { unref?: () => void }).unref?.();
}

export async function bootEventRuntime() {
  if (booted) return;
  booted = true;

  ensureAuditListenersBooted();
  WebhooksService.ensureBoot();
  ensureFunctionEventTriggersBooted();

  await replayOutbox("boot");
  startEventOutboxWorker();
}
