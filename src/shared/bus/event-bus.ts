import { randomUUID } from "node:crypto";
import { logger } from "../logger";
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
    const set = this.listeners.get(name);
    if (!set) return;
    for (const listener of set) {
      try {
        const ret = (listener as Listener<E>)(envelope);
        if (ret && typeof (ret as Promise<void>).catch === "function") {
          (ret as Promise<void>).catch((err) =>
            logger.error({ err, event: name }, "bus listener rejected")
          );
        }
      } catch (err) {
        logger.error({ err, event: name }, "bus listener threw");
      }
    }
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
