import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/shared/prisma", () => ({
  prisma: {
    policyDocument: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    }
  }
}));

import { prisma } from "@/shared/prisma";
import { createI18n } from "@/shared/i18n";
import { PolicyAdminService } from "../service";

type PolicyRow = {
  id: string;
  appId: string;
  scope: string;
  target: string | null;
  document: string;
  description: string | null;
  createdAt: number;
  updatedAt: number;
  createdById: string | null;
};

const policyDocument = prisma.policyDocument as unknown as Record<"findMany" | "findFirst" | "create" | "update", Mock>;

type PolicyRowInput = Omit<Partial<PolicyRow>, "document"> & { document?: unknown };

function row(overrides: PolicyRowInput): PolicyRow {
  const document = typeof overrides.document === "string"
    ? overrides.document
    : JSON.stringify(overrides.document ?? { default: { read: ["$public"] } });
  return {
    id: overrides.id ?? "pol_1",
    appId: overrides.appId ?? "app1",
    scope: overrides.scope ?? "app",
    target: overrides.target ?? null,
    document,
    description: overrides.description ?? null,
    createdAt: overrides.createdAt ?? 1,
    updatedAt: overrides.updatedAt ?? 1,
    createdById: overrides.createdById ?? "u1"
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PolicyAdminService", () => {
  it("lists policies sorted by app -> dataType -> record and returns normalized preview", async () => {
    policyDocument.findMany.mockResolvedValue([
      row({ id: "record", scope: "record", target: "rec1" }),
      row({ id: "app", scope: "app", target: null }),
      row({ id: "type", scope: "dataType", target: "post" })
    ]);

    const policies = await PolicyAdminService.list("app1");

    expect(policies.map((policy) => policy.scope)).toEqual(["app", "dataType", "record"]);
    expect(policies[0]?.normalized.version).toBe(2);
  });

  it("upserts app policy as normalized v2 document", async () => {
    policyDocument.findFirst.mockResolvedValue(null);
    policyDocument.create.mockImplementation(async ({ data }) => row({ id: "created", ...data }));

    const result = await PolicyAdminService.upsert(
      "app1",
      {
        scope: "app",
        target: "ignored",
        description: "default policy",
        document: { default: { read: ["$public"], write: ["$owner"] } }
      },
      "u1"
    );

    expect(policyDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          appId: "app1",
          scope: "app",
          target: null,
          description: "default policy"
        })
      })
    );
    const createArg = policyDocument.create.mock.calls[0]?.[0];
    expect(createArg).toBeDefined();
    expect(JSON.parse(createArg.data.document)).toMatchObject({ version: 2 });
    expect(result.policy.normalized.rules.map((rule) => rule.id)).toEqual(["legacy-default-read", "legacy-default-write"]);
  });

  it("rejects dataType scope without target", async () => {
    await expect(
      PolicyAdminService.upsert(
        "app1",
        { scope: "dataType", target: null, document: { version: 2, rules: [] } },
        "u1"
      )
    ).rejects.toMatchObject({ code: "POLICY_INVALID_DOCUMENT" });
  });

  it("explains with app -> dataType -> record chain", async () => {
    policyDocument.findMany.mockResolvedValue([
      row({ scope: "record", target: "rec1", document: { version: 2, rules: [] } }),
      row({ scope: "app", target: null, document: { default: { read: ["$owner"] } } }),
      row({ scope: "dataType", target: "post", document: { default: { read: ["$public"] } } })
    ]);

    const result = await PolicyAdminService.explain("app1", {
      scope: "record",
      target: "rec1",
      dataType: "post",
      action: "read",
      actor: { userId: null, origin: "system" }
    });

    expect(policyDocument.findMany).toHaveBeenCalledWith({
      where: {
        appId: "app1",
        OR: [
          { scope: "app", target: null },
          { scope: "dataType", target: "post" },
          { scope: "record", target: "rec1" }
        ]
      }
    });
    expect(result.decision.allow).toBe(true);
    expect(result.documents).toHaveLength(3);
  });

  it("previews migration from provided legacy document", async () => {
    const { t } = createI18n("zh-CN");
    const preview = await PolicyAdminService.previewMigration(
      "app1",
      {
        document: { default: { read: ["$public"], write: ["$owner"] } }
      },
      "zh-CN"
    );

    expect(preview.normalized.version).toBe(2);
    expect(preview.warnings).toContain(t("policy.migration.defaultWriteKept"));
  });
});