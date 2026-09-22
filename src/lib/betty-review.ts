import { round2 } from "./scoring";

export type ReviewResult = "si" | "parcial" | "no" | "na" | "";

export interface ReviewItem {
  points: number;
  result: ReviewResult;
  area?: string | null;
}

/**
 * Puntos ganados por un ítem según la revisión del coordinador.
 * - si  → todos los puntos
 * - parcial → la mitad (para ítems auto de 1/0.5/0 o 0.5/0.25/0 ese es el valor intermedio)
 * - no  → 0
 * - na / sin responder → no penaliza (cuenta completo, igual que la rúbrica oficial)
 */
export function earnedPoints(points: number, result: ReviewResult): number {
  const value = Number(points) || 0;
  if (result === "no") return 0;
  if (result === "parcial") return round2(value / 2);
  return value;
}

export function mapAiResult(aiResult: string | null | undefined): ReviewResult {
  if (aiResult === "si" || aiResult === "parcial" || aiResult === "no" || aiResult === "na") return aiResult;
  return "";
}

export function computeReview(items: ReviewItem[]): {
  total: number;
  possible: number;
  earned: number;
  areas: Array<{ area: string; earned: number; possible: number }>;
} {
  const map = new Map<string, { earned: number; possible: number }>();
  let earned = 0;
  let possible = 0;
  for (const item of items) {
    const key = item.area ?? "General";
    const current = map.get(key) ?? { earned: 0, possible: 0 };
    const gained = earnedPoints(item.points, item.result);
    current.earned = round2(current.earned + gained);
    current.possible = round2(current.possible + (Number(item.points) || 0));
    map.set(key, current);
    earned = round2(earned + gained);
    possible = round2(possible + (Number(item.points) || 0));
  }
  return {
    earned,
    possible,
    total: possible > 0 ? round2((10 * earned) / possible) : 0,
    areas: [...map.entries()].map(([area, v]) => ({ area, ...v })),
  };
}
