import type { Metrics } from "./transcript";
import type { ItemKind } from "./scoring";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue | undefined };

export type AnswerValue = "" | "si" | "no" | "na";

export interface MonitoringItem {
  id: string;
  template_id: string | null;
  kind: ItemKind | null;
  section: string | null;
  area: string | null;
  item_number: string | null;
  short_label: string | null;
  description: string;
  points: number | null;
  area_points: number | null;
  penalty_kind: string | null;
  sort_order: number | null;
}

export interface MonitoringAnswer {
  item_id: string;
  result: AnswerValue;
  comment: string;
}

export interface StudentDraft {
  student_number: number;
  student_name: string;
  gr: string;
  pr: string;
  fl: string;
  co: string;
  in: string;
  score: number | null;
  phrase: string;
  goal: boolean;
  coach_phrase: string;
  comment: string;
}

export interface AoiEntry { text: string; item_id?: string | null }
export interface PreviousAoi { text: string; date?: string | null }

export function studentPhrase(score: number): string {
  if (score >= 9) return "Excellent";
  if (score >= 8) return "Great job";
  if (score >= 7) return "Almost There";
  return "Needs Improvement";
}

export function calculateStudent(values: Pick<StudentDraft, "gr" | "pr" | "fl" | "co" | "in">) {
  const numbers = [values.gr, values.pr, values.fl, values.co, values.in]
    .map(Number)
    .filter(Number.isFinite);
  if (numbers.length === 0) return { score: null, phrase: "" };
  const score = Math.round((numbers.reduce((a, b) => a + b, 0) / numbers.length) * 10) / 10;
  return { score, phrase: studentPhrase(score) };
}

export function normalizeTextList(value: JsonValue | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => typeof entry === "string" ? entry : String((entry as { text?: unknown })?.text ?? "")).filter(Boolean);
}

export function normalizeAois(value: JsonValue | undefined): AoiEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => typeof entry === "string"
    ? { text: entry }
    : { text: String((entry as { text?: unknown })?.text ?? ""), item_id: (entry as { item_id?: string | null })?.item_id ?? null })
    .filter((entry) => entry.text);
}

export function resolvedAois(previous: JsonValue | undefined, currentAois: AoiEntry[], answers: MonitoringAnswer[]): number {
  const previousTexts = normalizeTextList(previous).map((text) => text.trim().toLowerCase());
  const yesIds = new Set(answers.filter((answer) => answer.result === "si").map((answer) => answer.item_id));
  const resolvedTexts = new Set(
    currentAois.filter((aoi) => aoi.item_id && yesIds.has(aoi.item_id)).map((aoi) => aoi.text.trim().toLowerCase()),
  );
  return previousTexts.filter((text) => resolvedTexts.has(text)).length;
}

export function reportShareText(report: ReportData, url: string): string {
  const m = report.monitoring;
  const kudos = normalizeTextList(m.kudos)[0] ?? "—";
  const aoi = m.main_aoi || normalizeAois(m.aois)[0]?.text || "—";
  const metrics = m.transcript_metrics;
  return [
    `QA · ${report.coach.name}`,
    `Puntaje: ${m.final_score ?? "—"} · ${m.result_phrase ?? ""}`,
    `Kudo: ${kudos}`,
    `AOI: ${aoi}`,
    metrics ? `Alumnos: ${metrics.students_pct} % (${metrics.traffic_light})` : "Talking time: sin análisis",
    url,
  ].join("\n");
}

export interface ReportData {
  coach: { name: string; lob?: string | null; level?: string | null };
  template: { id?: string; name: string; code: string; scoring?: string | null; has_student_grid?: boolean };
  coordinator: { name: string };
  monitoring: {
    id: string; class_date: string | null; qa_date: string | null; syllabus?: string | null;
    schedule?: string | null; level?: string | null; status: string; base_score: number | null;
    bonus_total: number | null; penalty_applied: boolean; final_score: number | null;
    result_phrase: string | null; customer_expectation: string | null; kudos: JsonValue;
    aois: JsonValue; main_aoi: string | null; previous_aois: JsonValue; transcript_metrics: Metrics | null;
    general_comments: string | null; share_token?: string | null; created_at?: string; updated_at?: string;
  };
  answers: Array<MonitoringAnswer & { id?: string; item: MonitoringItem }>;
  students: Array<{ student_number: number | null; student_name: string | null; gr: number | null; pr: number | null; fl: number | null; co: number | null; in: number | null; score: number | null; phrase: string | null; goal: boolean | null; coach_phrase: string | null; comment: string | null }>;
  previous: { id?: string; date: string | null; final_score: number | null; students_pct: number | null; aois?: JsonValue; main_aoi?: string | null } | null;
  recent_scores: Array<{ date: string | null; score: number }>;
}
