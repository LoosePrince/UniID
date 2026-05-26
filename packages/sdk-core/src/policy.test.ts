import { describe, expect, it } from "vitest";
import { policy } from "./policy";

describe("sdk policy builder", () => {
  it("builds publicRead document", () => {
    expect(policy.publicRead()).toEqual({
      version: 2,
      rules: [
        {
          id: "public-read",
          effect: "allow",
          actions: ["read"],
          subjects: ["$public"],
          resource: undefined,
          using: null,
          check: null
        }
      ]
    });
  });

  it("builds ownerWritePublicRead template", () => {
    const doc = policy.ownerWritePublicRead();

    expect(doc.rules.map((rule) => rule.id)).toEqual(["public-read", "owner-write"]);
    expect(doc.rules[1]?.actions).toEqual(["create", "update", "delete", "set", "unset", "push", "increment"]);
  });

  it("builds field scoped rule", () => {
    expect(policy.field(["data.title", "data.summary"], "read", "$public", "public-title")).toEqual({
      id: "public-title",
      effect: "allow",
      actions: ["read"],
      subjects: ["$public"],
      resource: { fields: ["data.title", "data.summary"] },
      using: null,
      check: null
    });
  });

  it("builds dynamic owner key rule", () => {
    expect(policy.dynamicOwnerKey({ field: "data.likes.*", path: "likes.$user" })).toMatchObject({
      id: "dynamic-owner-key",
      actions: ["set", "unset", "push"],
      subjects: ["$dynamic:likes.$user"],
      resource: { fields: ["data.likes.*"] }
    });
  });

  it("migrates v1 field rules to v2", () => {
    const doc = policy.fromV1({
      default: { read: ["$owner"], write: ["$owner"] },
      fields: { "data.title": { read: ["$public"] } }
    });

    expect(doc.rules.map((rule) => rule.id)).toEqual([
      "legacy-field-data-title-read",
      "legacy-default-read",
      "legacy-default-write"
    ]);
  });

  it("keeps deprecated helpers returning v2 documents", () => {
    expect(policy.public().version).toBe(2);
    expect(policy.private().version).toBe(2);
    expect(policy.readOnly().version).toBe(2);
  });
});