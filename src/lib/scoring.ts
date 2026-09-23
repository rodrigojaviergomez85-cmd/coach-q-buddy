/**
 * Reglas de negocio de QA Coaches E4K.
 * Funciones puras: no tocan red, ni fechas del sistema.
 */

export type TemplateScoring = "points_sum" | "area_weighted" | "checklist";
export type ItemKind = "item" | "checklist" | "penalty" | "bonus";
export type AnswerResult = "si" | "no" | "na";

export interface ScoringTemplate {
  id?: string;
  scoring: TemplateScoring | null;
}

export interface ScoringItem {
  id: string;
  kind: ItemKind | null;
  area?: string | null;
  points?: number | null;
  area_points?: number | null;
  penalty_kind?: string | null;
}

export interface ScoringAnswer {
  item_id: string;
  result: AnswerResult;
}

export interface PhraseRule {
  min: number;
  phrase: string;
}

export interface ScoringConfig {
  bonus_points_each: number;
  penalty_cap: number;
  score_phrases?: PhraseRule[];
  expectation_phrases?: PhraseRule[];
}

/** Redondea a 2 decimales. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function answerMap(answers: ScoringAnswer[]): Map<string, AnswerResult> {
  const map = new Map<string, AnswerResult>();
  for (const a of answers) map.set(a.item_id, a.result);
  return map;
}

/**
 * Puntaje base (0-10) según el tipo de scoring de la plantilla.
 * Regla igual al Excel original: el puntaje empieza en 10 y solo baja con cada "no".
 * Los ítems N/A no penalizan ni reescalan.
 * - points_sum: 10 x (total_puntos - puntos de items 'no') / total_puntos (TODOS los ítems).
 * - area_weighted: por área, area_points x (ítems del área - ítems 'no') / ítems del área.
 * - checklist: 10 x (total checklist - checklist 'no') / total checklist.
 */
export function computeBaseScore(
  template: ScoringTemplate,
  items: ScoringItem[],
  answers: ScoringAnswer[],
): number {
  const results = answerMap(answers);
  const resultOf = (item: ScoringItem): AnswerResult => results.get(item.id) ?? "na";

  const isNo = (item: ScoringItem): boolean => resultOf(item) === "no";

  if (template.scoring === "checklist") {
    const checks = items.filter((i) => i.kind === "checklist");
    if (checks.length === 0) return 0;
    const no = checks.filter(isNo).length;
    return round2((10 * (checks.length - no)) / checks.length);
  }

  if (template.scoring === "area_weighted") {
    const scored = items.filter((i) => i.kind === "item");
    const areas = new Map<string, ScoringItem[]>();
    for (const item of scored) {
      const key = item.area ?? "";
      const list = areas.get(key) ?? [];
      list.push(item);
      areas.set(key, list);
    }
    let total = 0;
    for (const list of areas.values()) {
      if (list.length === 0) continue;
      const no = list.filter(isNo).length;
      const areaPoints = Number(list[0]?.area_points ?? 0);
      total += (areaPoints * (list.length - no)) / list.length;
    }
    return round2(total);
  }

  // points_sum (por defecto)
  const scored = items.filter((i) => i.kind === "item");
  const possible = scored.reduce((sum, i) => sum + Number(i.points ?? 0), 0);
  if (possible <= 0) return 0;
  const lost = scored
    .filter(isNo)
    .reduce((sum, i) => sum + Number(i.points ?? 0), 0);
  return round2((10 * (possible - lost)) / possible);
}

/** Puntaje final: base + bonus, tope 10; si hay penalidad, tope penalty_cap. */
export function computeFinalScore(
  base: number,
  bonusCount: number,
  penaltyCount: number,
  config: ScoringConfig,
): number {
  const bonusEach = Number(config.bonus_points_each ?? 0);
  let final = Math.min(10, base + bonusCount * bonusEach);
  if (penaltyCount > 0) final = Math.min(final, Number(config.penalty_cap ?? 5));
  return round2(final);
}

function matchPhrase(score: number, rules: PhraseRule[] | undefined): string {
  if (!rules || rules.length === 0) return "";
  const sorted = [...rules].sort((a, b) => b.min - a.min);
  for (const rule of sorted) {
    if (score >= rule.min) return rule.phrase;
  }
  return sorted[sorted.length - 1]?.phrase ?? "";
}

/** Frase de resultado según el puntaje. */
export function phraseFor(score: number, rules: PhraseRule[] | undefined): string {
  return matchPhrase(score, rules);
}

/** Frase de expectativa del cliente según el puntaje. */
export function expectationFor(score: number, rules: PhraseRule[] | undefined): string {
  return matchPhrase(score, rules);
}

/**
 * Regla M-TH 2026 (Excel QA_Forms_2026_2 · M-TH):
 * bonus = 2 si hay EPIC AF, 1 si hay algún bonus "Yes", 0 si no (no acumulativo).
 * final = MIN(Auto 5 ? 5 + bonus : base + bonus, 10).
 */
export function mthBonus(hasEpic: boolean, anyYes: boolean): number {
  return hasEpic ? 2 : anyYes ? 1 : 0;
}

export function mthFinalScore(base: number, bonus: number, penalty: boolean): number {
  return round2(Math.min(penalty ? 5 + bonus : base + bonus, 10));
}
