import { describe, expect, it } from "vitest";
import { matchFieldPath, findMostSpecificFieldMatch } from "../wildcard";

describe("matchFieldPath", () => {
  it("exact match", () => {
    expect(matchFieldPath("data.title", "data.title")).toBe(true);
  });

  it("trailing wildcard matches any suffix including empty", () => {
    expect(matchFieldPath("data.likes.*", "data.likes.alice")).toBe(true);
    expect(matchFieldPath("data.likes.*", "data.likes")).toBe(true);
    expect(matchFieldPath("data.likes.*", "data.likes.alice.time")).toBe(true);
  });

  it("middle wildcard segment matches one component only", () => {
    expect(matchFieldPath("data.*.id", "data.user.id")).toBe(true);
    expect(matchFieldPath("data.*.id", "data.user.profile.id")).toBe(false);
  });

  it("no match for different prefix", () => {
    expect(matchFieldPath("data.title", "data.body")).toBe(false);
  });
});

describe("findMostSpecificFieldMatch", () => {
  it("picks the deepest (most specific) match", () => {
    const fields = {
      "data.*": "a",
      "data.likes.*": "b",
      "data.likes.alice": "c"
    };
    expect(findMostSpecificFieldMatch(fields, "data.likes.alice")?.value).toBe("c");
    expect(findMostSpecificFieldMatch(fields, "data.likes.bob")?.value).toBe("b");
    expect(findMostSpecificFieldMatch(fields, "data.other")?.value).toBe("a");
  });

  it("returns null when nothing matches", () => {
    expect(findMostSpecificFieldMatch({ "data.foo": "x" }, "data.bar")).toBeNull();
  });
});
