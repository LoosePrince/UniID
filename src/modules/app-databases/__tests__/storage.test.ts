import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/shared/config", () => ({
  config: () => ({
    DEFAULT_MAIN_RECORD_LIMIT: 2,
    DEFAULT_MAIN_STORAGE_BYTES: 24,
    UNIID_DATABASES_DIR: "./data/app-databases"
  })
}));

vi.mock("@/shared/prisma", () => ({
  prisma: {
    dataStorageBinding: {
      findUnique: vi.fn()
    },
    record: {
      findMany: vi.fn()
    }
  }
}));

import { prisma } from "@/shared/prisma";
import { AppDatabaseService } from "../service";

const dataStorageBinding = prisma.dataStorageBinding as unknown as { findUnique: Mock };
const record = prisma.record as unknown as { findMany: Mock };

describe("AppDatabaseService main storage guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dataStorageBinding.findUnique.mockResolvedValue(null);
    record.findMany.mockResolvedValue([]);
  });

  it("allows main storage writes under the app record and byte limits", async () => {
    record.findMany.mockResolvedValue([{ id: "r1", data: JSON.stringify({ a: 1 }) }]);

    await expect(
      AppDatabaseService.assertMainStorageWritable({
        appId: "app_1",
        dataType: "posts",
        data: { b: 2 }
      })
    ).resolves.toBeUndefined();
  });

  it("blocks main storage writes over the app record limit", async () => {
    record.findMany.mockResolvedValue([
      { id: "r1", data: "{}" },
      { id: "r2", data: "{}" }
    ]);

    await expect(
      AppDatabaseService.assertMainStorageWritable({
        appId: "app_1",
        dataType: "posts",
        data: { next: true }
      })
    ).rejects.toMatchObject({ code: "DATA_STORAGE_MAIN_LIMIT_EXCEEDED" });
  });

  it("blocks main storage writes over the app json byte limit", async () => {
    record.findMany.mockResolvedValue([{ id: "r1", data: JSON.stringify({ payload: "1234567890" }) }]);

    await expect(
      AppDatabaseService.assertMainStorageWritable({
        appId: "app_1",
        dataType: "posts",
        data: { payload: "1234567890" }
      })
    ).rejects.toMatchObject({ code: "DATA_STORAGE_MAIN_LIMIT_EXCEEDED" });
  });

  it("blocks Data API reads and writes after dataType migrated to external_sql", async () => {
    dataStorageBinding.findUnique.mockResolvedValue({
      appId: "app_1",
      dataType: "posts",
      storageKind: "external_sql",
      databaseId: "db_1",
      tableName: "posts"
    });

    await expect(AppDatabaseService.assertMainStorageReadable("app_1", "posts")).rejects.toMatchObject({
      code: "DATA_STORAGE_EXTERNAL_SQL"
    });
    await expect(
      AppDatabaseService.assertMainStorageWritable({
        appId: "app_1",
        dataType: "posts",
        data: { title: "hello" }
      })
    ).rejects.toMatchObject({ code: "DATA_STORAGE_EXTERNAL_SQL" });
  });
});
