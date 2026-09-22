import { describe, expect, it } from "vitest";
import { computeReview, earnedPoints, mapAiResult, bettyFinalScore } from "./betty-review";

describe("betty-review", () => {
  it("parcial vale la mitad de los puntos", () => {
    expect(earnedPoints(1, "parcial")).toBe(0.5);
    expect(earnedPoints(0.5, "parcial")).toBe(0.25);
    expect(earnedPoints(0.75, "parcial")).toBe(0.375);
  });

  it("ítem de 0.75 en Parcial suma 0.375 en área y total", () => {
    const result = computeReview([
      { points: 0.75, result: "parcial", area: "D1" },
      { points: 0.25, result: "si", area: "D2" },
    ]);
    expect(result.areas[0]!.earned).toBeCloseTo(0.375, 2);
    expect(result.earned).toBeCloseTo(0.625, 2);
  });

  it("no penaliza N/A ni sin responder", () => {
    const result = computeReview([
      { points: 5, result: "na", area: "A" },
      { points: 5, result: "", area: "A" },
    ]);
    expect(result.total).toBe(10);
  });

  it("resta solo los No", () => {
    const result = computeReview([
      { points: 5, result: "si", area: "A" },
      { points: 5, result: "no", area: "B" },
    ]);
    expect(result.total).toBe(5);
  });

  it("mapea el resultado de Betty", () => {
    expect(mapAiResult("parcial")).toBe("parcial");
    expect(mapAiResult("nd")).toBe("");
  });
});

describe("bettyFinalScore", () => {
  const cfg = { bonus_points_each: 1, penalty_cap: 5 };

  it("nd/sin responder no penaliza y parcial vale la mitad", () => {
    const items = [
      { kind: "item", points: 5, area: "A", result: "si" as const },
      { kind: "item", points: 5, area: "A", result: "" as const },
    ];
    expect(bettyFinalScore("points_sum", items, 0, 0, cfg).base).toBe(10);
    expect(bettyFinalScore("points_sum", [{ kind: "item", points: 10, area: "A", result: "parcial" as const }], 0, 0, cfg).base).toBe(5);
  });

  it("aplica bonus y penalidad como el QA oficial", () => {
    const items = [{ kind: "item", points: 10, area: "A", result: "si" as const }];
    expect(bettyFinalScore("points_sum", items, 1, 0, cfg).final).toBe(10);
    expect(bettyFinalScore("points_sum", items, 0, 1, cfg).final).toBe(5);
  });
});
