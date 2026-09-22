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
  if (result === "parcial") return value / 2;
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
    current.earned += gained;
    current.possible += Number(item.points) || 0;
    map.set(key, current);
    earned += gained;
    possible += Number(item.points) || 0;
  }
  return {
    earned,
    possible,
    total: possible > 0 ? round2((10 * earned) / possible) : 0,
    areas: [...map.entries()].map(([area, v]) => ({ area, ...v })),
  };
}

export type BettyScoring = "points_sum" | "area_weighted" | "checklist" | null;

export interface BettyScoreItem {
  kind: string | null;
  points?: number | null;
  area_points?: number | null;
  area?: string | null;
  result: ReviewResult;
}

/** Fracción de puntos perdida por un resultado (parcial = mitad, N/A no penaliza). */
function lossFactor(result: ReviewResult): number {
  if (result === "no") return 1;
  if (result === "parcial") return 0.5;
  return 0;
}

/**
 * Puntaje de Betty respetando el modelo de scoring de la plantilla
 * (misma lógica que scoring.ts: N/A no penaliza) y admitiendo "parcial".
 */
export function computeBettyScore(
  scoring: BettyScoring,
  items: BettyScoreItem[],
): { total: number; areas: Array<{ area: string; earned: number; possible: number }> } {
  const areaMap = new Map<string, { earned: number; possible: number }>();
  const add = (area: string, earned: number, possible: number) => {
    const cur = areaMap.get(area) ?? { earned: 0, possible: 0 };
    cur.earned += earned;
    cur.possible += possible;
    areaMap.set(area, cur);
  };

  if (scoring === "checklist") {
    const checks = items.filter((i) => i.kind === "checklist");
    let lost = 0;
    for (const c of checks) {
      lost += lossFactor(c.result);
      add(c.area ?? "General", 1 - lossFactor(c.result), 1);
    }
    const total = checks.length > 0 ? round2((10 * (checks.length - lost)) / checks.length) : 0;
    return { total, areas: [...areaMap.entries()].map(([area, v]) => ({ area, ...v })) };
  }

  const scored = items.filter((i) => i.kind === "item");

  if (scoring === "area_weighted") {
    const groups = new Map<string, BettyScoreItem[]>();
    for (const item of scored) {
      const key = item.area ?? "General";
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    let total = 0;
    for (const [area, list] of groups) {
      if (list.length === 0) continue;
      const areaPoints = Number(list[0]?.area_points ?? 0);
      const lost = list.reduce((sum, i) => sum + lossFactor(i.result), 0);
      const earned = (areaPoints * (list.length - lost)) / list.length;
      total += earned;
      add(area, earned, areaPoints);
    }
    return { total: round2(total), areas: [...areaMap.entries()].map(([area, v]) => ({ area, ...v })) };
  }

  // points_sum (por defecto)
  let possible = 0;
  let lost = 0;
  for (const item of scored) {
    const pts = Number(item.points ?? 0);
    possible += pts;
    lost += pts * lossFactor(item.result);
    add(item.area ?? "General", pts - pts * lossFactor(item.result), pts);
  }
  const total = possible > 0 ? round2((10 * (possible - lost)) / possible) : 0;
  return { total, areas: [...areaMap.entries()].map(([area, v]) => ({ area, ...v })) };
}
