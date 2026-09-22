import { describe, expect, it } from "vitest";

import {
  autoFlagResult,
  autoItemResult,
  computeDeterministic,
  isSpanishSegment,
  transcriptHash,
  type BettyAutoConfig,
} from "./betty-metrics";
import { classifySpeakers, computeMetrics, type Segment, type TranscriptConfig } from "./transcript";

const config: TranscriptConfig = { talk_time_green: 70, talk_time_yellow: 55, student_min_pct: 8 };
const autoConfig: BettyAutoConfig = {
  talk_time_target_kids: 50,
  talk_time_target_teens: 60,
  talk_time_target_adults: 60,
  student_min_pct: 8,
};

function seg(speaker: string, start: number, end: number, text: string): Segment {
  return { speaker, start, end, text };
}

function build(segments: Segment[]) {
  const roles = classifySpeakers(segments);
  const metrics = computeMetrics(segments, roles, config);
  return computeDeterministic(segments, roles, metrics);
}

describe("español del coach", () => {
  it("marca segmentos con 2+ palabras funcionales en español", () => {
    expect(isSpanishSegment("vamos a ver la clase")).toBe(true);
    expect(isSpanishSegment("open your book please")).toBe(false);
  });

  it("calcula el porcentaje de habla en español del coach", () => {
    const det = build([
      seg("Coach Pame", 0, 10, "Good morning everyone, open your books"),
      seg("Coach Pame", 10, 20, "Vamos a repasar la clase de ayer"),
      seg("Ana", 20, 25, "Hello coach"),
      seg("Coach Pame", 25, 35, "Great job Ana"),
    ]);
    expect(det.coach_spanish_pct).toBeCloseTo(33.3, 1);
    expect(det.spanish_examples).toHaveLength(1);
  });
});

describe("afirmaciones y rapport", () => {
  it("cuenta afirmaciones y detecta el fin del rapport", () => {
    const det = build([
      seg("Coach Pame", 0, 10, "How was your weekend?"),
      seg("Ana", 10, 20, "It was good"),
      seg("Coach Pame", 120, 130, "Repeat with me: I am a champion"),
      seg("Coach Pame", 140, 150, "I can do it, everyone!"),
      seg("Coach Pame", 200, 210, "Ok, let's start the first activity"),
    ]);
    expect(det.affirmations.count).toBe(2);
    expect(det.rapport_end_min).toBeCloseTo(3.3, 1);
  });
});

describe("break y AF", () => {
  it("detecta el break por la palabra break seguida de un hueco", () => {
    const det = build([
      seg("Coach Pame", 0, 10, "Welcome everyone"),
      seg("Coach Pame", 1500, 1510, "Ok team, time for a 5 minute break"),
      seg("Coach Pame", 1810, 1820, "Welcome back, let's continue"),
      seg("Coach Pame", 2000, 2010, "Now automatic fluency time"),
      seg("Ana", 2020, 2035, "Yesterday I went to the park with my family and friends"),
      seg("Ana", 2100, 2115, "I also played soccer with my brother in the afternoon"),
      seg("Luis", 2200, 2215, "My favorite food is pizza because it is really delicious"),
    ]);
    expect(det.break.start).toBe(1500);
    expect(det.break.end).toBe(1810);
    expect(det.break.duration_min).toBeCloseTo(5.2, 1);
    expect(det.af_window.start).toBe(2000);
    expect(det.af_students.map((s) => s.name).sort()).toEqual(["Ana", "Luis"]);
    expect(det.af_students.find((s) => s.name === "Ana")?.turns).toBe(2);
  });
});

describe("expansión", () => {
  it("cuenta turnos largos con conector y descarta los cortos", () => {
    const det = build([
      seg("Coach Pame", 0, 5, "Why?"),
      seg("Ana", 10, 25, "I like summer because I can swim in the pool every single day"),
      seg("Luis", 30, 40, "Because it is fun"),
    ]);
    expect(det.expansion.count).toBe(1);
    expect(det.expansion.students).toBe(1);
    expect(det.expansion.coach_push_count).toBe(1);
  });
});

describe("ítems automáticos", () => {
  const det = build([
    seg("Coach Pame", 0, 60, "Hello everyone"),
    seg("Ana", 60, 200, "I went to the park because the weather was nice and sunny today"),
    seg("Luis", 200, 340, "My favorite subject is math since I like numbers and solving problems"),
  ]);

  it("P1 según la meta del LOB", () => {
    expect(autoItemResult("P1", det, { lob: "Kids", config: autoConfig })?.result).toBe("si");
    expect(autoItemResult("P1", { ...det, students_pct: 45 }, { lob: "Teens", config: autoConfig })?.result)
      .toBe("no");
    expect(autoItemResult("P1", { ...det, students_pct: 52 }, { lob: "Teens", config: autoConfig })?.result)
      .toBe("parcial");
  });

  it("P2 con equidad", () => {
    expect(
      autoItemResult("P2", { ...det, students_below_min: [], top3_students_pct: 50 }, { config: autoConfig })
        ?.result,
    ).toBe("si");
    expect(
      autoItemResult("P2", { ...det, students_below_min: ["Ana"], top3_students_pct: 50 }, { config: autoConfig })
        ?.result,
    ).toBe("parcial");
    expect(
      autoItemResult("P2", { ...det, students_below_min: ["Ana"], top3_students_pct: 90 }, { config: autoConfig })
        ?.result,
    ).toBe("no");
  });

  it("P5 no aplica con nivel 3", () => {
    expect(autoItemResult("P5", det, { level: "Level 3", config: autoConfig })?.result).toBe("na");
    expect(
      autoItemResult(
        "P5",
        { ...det, expansion: { ...det.expansion, students: 3, coach_push_count: 5 } },
        { level: "Level 7", config: autoConfig },
      )?.result,
    ).toBe("si");
  });

  it("M2 y E2 con tres niveles", () => {
    const base = { ...det };
    expect(autoItemResult("M2", { ...base, affirmations: { count: 6, minutes: [], quotes: [] } }, { config: autoConfig })?.result).toBe("si");
    expect(autoItemResult("M2", { ...base, affirmations: { count: 3, minutes: [], quotes: [] } }, { config: autoConfig })?.result).toBe("parcial");
    expect(autoItemResult("M2", { ...base, affirmations: { count: 1, minutes: [], quotes: [] } }, { config: autoConfig })?.result).toBe("no");
    expect(autoItemResult("E2", { ...base, rapport_end_min: 4, follow_up_questions: 3 }, { config: autoConfig })?.result).toBe("si");
    expect(autoItemResult("E2", { ...base, rapport_end_min: 9, follow_up_questions: 3 }, { config: autoConfig })?.result).toBe("parcial");
    expect(autoItemResult("E2", { ...base, rapport_end_min: 9, follow_up_questions: 0 }, { config: autoConfig })?.result).toBe("no");
  });

  it("penalidades y bonus automáticos", () => {
    expect(autoFlagResult("3. Too Much Spanish", { ...det, coach_spanish_pct: 25 }, { level: "Level 1" })?.result).toBe("si");
    expect(autoFlagResult("3. Too Much Spanish", { ...det, coach_spanish_pct: 15 }, { level: "Level 1" })?.result).toBe("no");
    expect(autoFlagResult("6. Timing (menos de 3 en AF)", { ...det, af_students: [] }, {})?.result).toBe("si");
    expect(autoFlagResult("8. 80/20", { ...det, students_pct: 75 }, {})?.result).toBe("si");
  });
});

describe("hash", () => {
  it("es estable y distinto por contenido", () => {
    expect(transcriptHash("abc")).toBe(transcriptHash("abc"));
    expect(transcriptHash("abc")).not.toBe(transcriptHash("abd"));
  });
});
