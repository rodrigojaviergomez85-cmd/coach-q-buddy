import { describe, expect, it } from "vitest";

import {
  computeBaseScore,
  computeFinalScore,
  expectationFor,
  phraseFor,
  round2,
  type ScoringItem,
} from "./scoring";

const config = {
  bonus_points_each: 1,
  penalty_cap: 5,
  score_phrases: [
    { min: 10, phrase: "Excellent Plus" },
    { min: 9, phrase: "Excellent" },
    { min: 8, phrase: "Well Done" },
    { min: 7, phrase: "Almost There" },
    { min: 0, phrase: "Needs Improvement" },
  ],
  expectation_phrases: [
    { min: 9, phrase: "Exceeded expectations" },
    { min: 7, phrase: "Met expectations" },
    { min: 0, phrase: "Below expectations" },
  ],
};

describe("round2", () => {
  it("redondea a 2 decimales", () => {
    expect(round2(8.3333333)).toBe(8.33);
    expect(round2(9.005)).toBe(9.01);
  });
});

describe("computeBaseScore points_sum", () => {
  const items: ScoringItem[] = [
    { id: "a", kind: "item", points: 25 },
    { id: "b", kind: "item", points: 15 },
    { id: "c", kind: "item", points: 10 },
    { id: "z", kind: "bonus", points: 1 },
  ];

  it("normaliza 50 puntos a 10", () => {
    const score = computeBaseScore({ scoring: "points_sum" }, items, [
      { item_id: "a", result: "si" },
      { item_id: "b", result: "si" },
      { item_id: "c", result: "si" },
    ]);
    expect(score).toBe(10);
  });

  it("n/a no penaliza ni reescala", () => {
    const score = computeBaseScore({ scoring: "points_sum" }, items, [
      { item_id: "a", result: "si" },
      { item_id: "b", result: "no" },
      { item_id: "c", result: "na" },
    ]);
    expect(score).toBe(7); // 10 * (50 - 15) / 50
  });

  it("empieza en 10 y solo baja con cada No", () => {
    expect(computeBaseScore({ scoring: "points_sum" }, items, [])).toBe(10);
    // Plantilla de 10 pts con un No de 0.5 → 9.5
    expect(
      computeBaseScore(
        { scoring: "points_sum" },
        [{ id: "p1", kind: "item", points: 10 }],
        [{ item_id: "p1", result: "si" }],
      ),
    ).toBe(10);
    // Plantilla de 50 pts con un No de 10 → 8
    expect(
      computeBaseScore(
        { scoring: "points_sum" },
        [
          { id: "q1", kind: "item", points: 40 },
          { id: "q2", kind: "item", points: 10 },
        ],
        [
          { item_id: "q1", result: "si" },
          { item_id: "q2", result: "no" },
        ],
      ),
    ).toBe(8);
  });
});

describe("computeBaseScore area_weighted", () => {
  const items: ScoringItem[] = [
    { id: "a1", kind: "item", area: "Teaching", area_points: 6 },
    { id: "a2", kind: "item", area: "Teaching", area_points: 6 },
    { id: "b1", kind: "item", area: "Soft Skills", area_points: 4 },
  ];

  it("pondera por área", () => {
    const score = computeBaseScore({ scoring: "area_weighted" }, items, [
      { item_id: "a1", result: "si" },
      { item_id: "a2", result: "no" },
      { item_id: "b1", result: "si" },
    ]);
    expect(score).toBe(7); // 6*0.5 + 4*1
  });
});

describe("computeBaseScore checklist", () => {
  const items: ScoringItem[] = [
    { id: "c1", kind: "checklist" },
    { id: "c2", kind: "checklist" },
    { id: "c3", kind: "checklist" },
  ];

  it("calcula 10 x si/aplicables", () => {
    const score = computeBaseScore({ scoring: "checklist" }, items, [
      { item_id: "c1", result: "si" },
      { item_id: "c2", result: "si" },
      { item_id: "c3", result: "no" },
    ]);
    expect(score).toBe(6.67);
  });
});

describe("computeFinalScore", () => {
  it("suma bonus con tope 10", () => {
    expect(computeFinalScore(9.5, 2, 0, config)).toBe(10);
    expect(computeFinalScore(7, 1, 0, config)).toBe(8);
    expect(computeFinalScore(7.1, 1, 0, config)).toBe(8.1);
    expect(computeFinalScore(9, 0, 1, config)).toBe(5);
  });

  it("aplica el tope de penalidad", () => {
    expect(computeFinalScore(9.5, 1, 1, config)).toBe(5);
    expect(computeFinalScore(3, 0, 1, config)).toBe(3);
  });
});

describe("frases", () => {
  it("phraseFor", () => {
    expect(phraseFor(10, config.score_phrases)).toBe("Excellent Plus");
    expect(phraseFor(9.2, config.score_phrases)).toBe("Excellent");
    expect(phraseFor(8, config.score_phrases)).toBe("Well Done");
    expect(phraseFor(4.5, config.score_phrases)).toBe("Needs Improvement");
  });

  it("expectationFor", () => {
    expect(expectationFor(9, config.expectation_phrases)).toBe("Exceeded expectations");
    expect(expectationFor(7.5, config.expectation_phrases)).toBe("Met expectations");
    expect(expectationFor(6, config.expectation_phrases)).toBe("Below expectations");
  });
});
