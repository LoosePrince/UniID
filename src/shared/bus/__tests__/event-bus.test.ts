import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/prisma", () => ({
  prisma: {
    eventOutbox: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn()
    }
  }
}));

import { prisma } from "@/shared/prisma";
import { bus } from "../event-bus";

const eventOutbox = prisma.eventOutbox as unknown as {
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  updateMany: ReturnType<typeof vi.fn>;
  findUnique: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
};

describe("EventBus publish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventOutbox.updateMany.mockResolvedValue({ count: 1 });
    eventOutbox.findUnique.mockResolvedValue({ attempts: 0 });
    bus.clear();
  });

  it("persists event before in-memory fanout", async () => {
    const received: unknown[] = [];
    bus.on("record.created", (env) => {
      received.push(env);
    });

    await bus.publish("record.created", {
      appId: "app1",
      dataType: "article",
      recordId: "rec1",
      ownerId: "user1",
      data: { title: "hello" },
      actorId: "user1",
      at: 1710000000
    });

    expect(eventOutbox.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          appId: "app1",
          eventType: "record.created",
          resourceType: "record",
          resourceId: "rec1",
          status: "pending"
        })
      })
    );
    expect(eventOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "dispatched" })
      })
    );
    expect(received).toHaveLength(1);
  });

  it("marks persisted event failed when listener rejects", async () => {
    bus.on("record.updated", async () => {
      throw new Error("listener failed");
    });

    await bus.publish("record.updated", {
      appId: "app1",
      dataType: "article",
      recordId: "rec1",
      ownerId: "user1",
      before: { title: "old" },
      after: { title: "new" },
      actorId: "user1",
      at: 1710000001
    });

    expect(eventOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "failed",
          attempts: 1
        })
      })
    );
  });

  it("replays pending outbox events", async () => {
    const received: unknown[] = [];
    const envelope = {
      id: "evt1",
      name: "record.deleted" as const,
      payload: {
        appId: "app1",
        dataType: "article",
        recordId: "rec1",
        ownerId: "user1",
        actorId: "user1",
        at: 1710000002
      },
      at: 1710000002000
    };
    eventOutbox.findMany.mockResolvedValue([{ id: "evt1", payload: JSON.stringify(envelope) }]);
    bus.on("record.deleted", (env) => {
      received.push(env);
    });

    const result = await bus.replay();

    expect(result).toEqual({ dispatched: 1, failed: 0 });
    expect(received).toEqual([envelope]);
    expect(eventOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "evt1" },
        data: expect.objectContaining({ status: "dispatched" })
      })
    );
  });
});
