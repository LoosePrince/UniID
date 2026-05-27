import { WebhooksService } from "@/modules/webhooks";
import { ensureFunctionEventTriggersBooted } from "@/modules/functions/listener";
import "@/modules/realtime/service";
import { ensureAuditListenersBooted } from "@/shared/audit";
import { logger } from "@/shared/logger";
import { bus } from "./event-bus";

let booted = false;

export async function bootEventRuntime() {
  if (booted) return;
  booted = true;

  ensureAuditListenersBooted();
  WebhooksService.ensureBoot();
  ensureFunctionEventTriggersBooted();

  try {
    const result = await bus.replay();
    if (result.dispatched > 0 || result.failed > 0) {
      logger.info(result, "event outbox replay completed");
    }
  } catch (err) {
    logger.error({ err }, "event outbox replay failed");
  }
}