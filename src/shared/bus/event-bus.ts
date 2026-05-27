import { randomUUID } from "node:crypto";
import { logger } from "../logger";
import { EventOutboxService } from "./outbox";
import type { DomainEventEnvelope, DomainEventMap, DomainEventName } from "./events";

type Listener<E extends DomainEventName> = (
  envelope: DomainEventEnvelope<E>
) => void | Promise<void>;

class EventBus {
  private listeners = new Map<DomainEventName, Set<Listener<DomainEventName>>>();

  on<E extends DomainEventName>(event: E, listener: Listener<E>): () => void {
    const set = (this.listeners.get(event) ?? new Set()) as Set<Listener<DomainEventName>>;
    set.add(listener as Listener<DomainEventName>);
    this.listeners.set(event, set);
    return () => {
      set.delete(listener as Listener<DomainEventName>);
    };
  }

  emit<E extends DomainEventName>(name: E, payload: DomainEventMap[E]): void {
    const envelope: DomainEventEnvelope<E> = {
      id: randomUUID(),
      name,
      payload,
      at: Date.now()
    };
    this.dispatch(envelope, false).catch((err) =>
      logger.error({ err, event: name }, "bus dispatch failed")
    );
  }

  async publish<E extends DomainEventName>(
    name: E,
    payload: DomainEventMap[E],
    options?: { causedByEventId?: string | null }
  ): Promise<DomainEventEnvelope<E>> {
    const envelope = await EventOutboxService.create(name, payload, options);
    try {
      await this.dispatch(envelope, true);
      await EventOutboxService.markDispatched(envelope.id);
    } catch (err) {
      await EventOutboxService.markFailed(envelope.id, err);
      logger.error({ err, event: name, eventId: envelope.id }, "bus publish failed");
    }
    return envelope;
  }

  async replay(limit = 100): Promise<{ dispatched: number; failed: number }> {
    const pending = await EventOutboxService.listPending(limit);
    let dispatched = 0;
    let failed = 0;

    for (const event of pending) {
      const envelope = EventOutboxService.parseEnvelope(event.payload);
      if (!envelope) {
        await EventOutboxService.markFailed(event.id, "Invalid event payload");
        failed += 1;
        continue;
      }

      try {
        await this.dispatch(envelope, true);
        await EventOutboxService.markDispatched(event.id);
        dispatched += 1;
      } catch (err) {
        await EventOutboxService.markFailed(event.id, err);
        failed += 1;
      }
    }

    return { dispatched, failed };
  }

  private async dispatch<E extends DomainEventName>(
    envelope: DomainEventEnvelope<E>,
    waitForListeners: boolean
  ): Promise<void> {
    const set = this.listeners.get(envelope.name);
    if (!set) return;

    const failures: unknown[] = [];
    const pending: Promise<void>[] = [];

    for (const listener of set) {
      try {
        const ret = (listener as Listener<E>)(envelope);
        if (ret && typeof (ret as Promise<void>).catch === "function") {
          const task = (ret as Promise<void>).catch((err) => {
            logger.error({ err, event: envelope.name }, "bus listener rejected");
            failures.push(err);
          });
          if (waitForListeners) pending.push(task);
        }
      } catch (err) {
        logger.error({ err, event: envelope.name }, "bus listener threw");
        failures.push(err);
      }
    }

    if (waitForListeners && pending.length > 0) await Promise.all(pending);
    if (failures.length > 0) throw new Error(`bus dispatch failed: ${failures.length} listener(s) failed`);
  }

  listenerCount<E extends DomainEventName>(event: E): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  clear(): void {
    this.listeners.clear();
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __uniid_bus__: EventBus | undefined;
}

export const bus: EventBus = globalThis.__uniid_bus__ ?? new EventBus();
if (process.env.NODE_ENV !== "production") {
  globalThis.__uniid_bus__ = bus;
}
