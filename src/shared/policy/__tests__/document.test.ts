import { describe, expect, it } from "vitest";
import { legacyToV2, normalizePolicyDocument, normalizePolicyDocuments } from "../document";

const legacy = {
  default: {
    read: ["$owner"],
    write: ["$owner"]
  },
  fields: {
    "data.title": { read: ["$public"] },
    "data.likes.*": { set: ["$dynamic:likes.$user"] }
  }
};

describe("PolicyDocument normalize", () => {
  it("converts legacy default and field blocks into v2 rules", () => {
    const doc = legacyToV2(legacy, "test");

    expect(doc.version).toBe(2);
    expect(doc.rules.map((rule) => rule.id)).toEqual([
      "test-field-data-title-read",
      "test-field-data-likes-set",
      "test-default-read",
      "test-default-write"
    ]);
    expect(doc.rules[0]?.resource?.fields).toEqual(["data.title"]);
    expect(doc.rules[1]?.resource?.fields).toEqual(["data.likes.*"]);
  });

  it("keeps valid v2 documents unchanged", () => {
    const v2 = {
      version: 2 as const,
      rules: [
        {
          id: "public-read",
          effect: "allow" as const,
          actions: ["read" as const],
          subjects: ["$public"],
          using: null,
          check: null
        }
      ]
    };

    expect(normalizePolicyDocument(v2)).toEqual(v2);
  });

  it("merges legacy documents by app -> dataType -> record precedence", () => {
    const app = { default: { read: ["$owner"] }, fields: { "data.title": { read: ["$owner"] } } };
    const dataType = { default: { update: ["$owner"] }, fields: { "data.title": { read: ["$public"] } } };
    const record = { default: { read: ["$public"] } };

    const result = normalizePolicyDocuments([app, dataType, record]);

    expect(result.legacyOnly).toBe(true);
    expect(result.document.rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "legacy-field-data-title-read", subjects: ["$public"], resource: { fields: ["data.title"] } }),
        expect.objectContaining({ id: "legacy-default-read", subjects: ["$public"] }),
        expect.objectContaining({ id: "legacy-default-update", subjects: ["$owner"] })
      ])
    );
  });

  it("preserves mixed v2 and legacy documents in composition order", () => {
    const v2 = {
      version: 2 as const,
      rules: [{ id: "app-public", effect: "allow" as const, actions: ["read" as const], subjects: ["$public"] }]
    };
    const mixed = normalizePolicyDocuments([v2, { default: { update: ["$owner"] } }]);

    expect(mixed.legacyOnly).toBe(false);
    expect(mixed.document.rules.map((rule) => rule.id)).toEqual(["app-public", "legacy-1-default-update"]);
  });
});