import { describe, expect, it } from "vitest";
import { calculateStudent, countNormalizedAois, resolvedAois } from "./monitoring";

describe("resolvedAois", () => {
  it("cuenta AOIs anteriores enlazados a ítems hoy marcados Sí", () => {
    expect(resolvedAois(
      [{ text: "Equal participation" }, { text: "Use gestures" }],
      [{ text: "Equal participation", item_id: "a" }, { text: "Use gestures", item_id: "b" }],
      [{ item_id: "a", result: "si", comment: "", evidence_time: null }, { item_id: "b", result: "no", comment: "", evidence_time: null }],
    )).toBe(1);
  });
});

describe("countNormalizedAois", () => {
  it("agrupa mayúsculas, acentos y puntuación", () => {
    expect(countNormalizedAois([["Participación equitativa"], [{ text: "participacion-equitativa" }]])[0]).toMatchObject({ count: 2 });
  });
});

describe("calculateStudent", () => {
  it("ignora criterios vacíos al calcular el promedio", () => {
    expect(calculateStudent({ gr: "10", pr: "8", fl: "", co: "", in: "" })).toEqual({
      score: 9,
      phrase: "Excellent",
    });
  });
});
