import { describe, expect, it } from "vitest";
import { resolvedAois } from "./monitoring";

describe("resolvedAois", () => {
  it("cuenta AOIs anteriores enlazados a ítems hoy marcados Sí", () => {
    expect(resolvedAois(
      [{ text: "Equal participation" }, { text: "Use gestures" }],
      [{ text: "Equal participation", item_id: "a" }, { text: "Use gestures", item_id: "b" }],
      [{ item_id: "a", result: "si", comment: "" }, { item_id: "b", result: "no", comment: "" }],
    )).toBe(1);
  });
});
