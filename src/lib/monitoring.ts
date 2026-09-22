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
  evidence_time: number | null;
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

export type CommitmentStatus = "cumplido" | "parcial" | "no_cumplido";
export type ClassPhaseKind = "inicio" | "contenido" | "break" | "af" | "cierre";
export interface ClassPhase { kind: ClassPhaseKind; start: number; end: number }
export interface ClassTimelineData {
  duration: number;
  phases: ClassPhase[];
  af_students: string[];
}

export function normalizeAoiKey(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function countNormalizedAois(values: Array<JsonValue | undefined>): Array<{ name: string; count: number }> {
  const counts = new Map<string, { name: string; count: number }>();
  for (const value of values) for (const entry of normalizeAois(value)) {
    const key = normalizeAoiKey(entry.text);
    if (!key) continue;
    const current = counts.get(key);
    counts.set(key, { name: current?.name ?? entry.text.trim(), count: (current?.count ?? 0) + 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function secondsToMarker(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export function markerToSeconds(value: string): number | null {
  const match = value.trim().match(/^(\d{1,3}):([0-5]\d)$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function zoomMarkerUrl(url: string | null | undefined, seconds: number | null | undefined): string | null {
  if (!url || seconds == null) return null;
  try { const parsed = new URL(url); parsed.searchParams.set("startTime", String(Math.floor(seconds))); return parsed.toString(); }
  catch { return null; }
}

export function studentPhrase(score: number): string {
  if (score >= 9) return "Excellent";
  if (score >= 8) return "Great job";
  if (score >= 7) return "Almost There";
  return "Needs Improvement";
}

export function calculateStudent(values: Pick<StudentDraft, "gr" | "pr" | "fl" | "co" | "in">) {
  const numbers = [values.gr, values.pr, values.fl, values.co, values.in]
    .filter((value) => value.trim() !== "")
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

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function kudosAoisHtml(kudos: string[], aois: AoiEntry[]): { html: string; text: string } {
  const kudosItems = kudos.map((k) => `<li>${escapeHtml(k)}</li>`).join("");
  const aoisItems = aois.map((a) => `<li>${escapeHtml(a.text)}</li>`).join("");
  const html = [
    "<h3>Kudos</h3>",
    kudos.length > 0 ? `<ul>${kudosItems}</ul>` : "<p>Sin kudos registrados.</p>",
    "<h3>AOIs</h3>",
    aois.length > 0 ? `<ul>${aoisItems}</ul>` : "<p>Sin AOIs registrados.</p>",
  ].join("");
  const text = [
    "Kudos",
    ...(kudos.length > 0 ? kudos.map((k) => `- ${k}`) : ["Sin kudos registrados."]),
    "",
    "AOIs",
    ...(aois.length > 0 ? aois.map((a) => `- ${a.text}`) : ["Sin AOIs registrados."]),
  ].join("\n");
  return { html, text };
}

export function reportShareText(report: ReportData, url: string, showScore = true): string {
  const m = report.monitoring;
  const kudos = normalizeTextList(m.kudos)[0] ?? "—";
  const aoi = m.main_aoi || normalizeAois(m.aois)[0]?.text || "—";
  const metrics = m.transcript_metrics;
  return [
    `QA · ${report.coach.name}`,
    showScore ? `Puntaje: ${m.final_score ?? "—"} · ${m.result_phrase ?? ""}` : `Resultado: ${m.result_phrase ?? "—"}`,
    `Kudo: ${kudos}`,
    `AOI: ${aoi}`,
    metrics ? `Alumnos: ${metrics.students_pct} % (${metrics.traffic_light})` : "Talking time: sin análisis",
    ...(metrics
      ? metrics.speakers
          .filter((s) => s.role === "alumno")
          .map((s) => `· ${s.name}: ${s.min} min · ${s.pct_of_students} %`)
      : []),
    url,
  ].join("\n");
}

export interface ReportData {
  config?: { talk_time_green: number; talk_time_yellow: number; student_min_pct: number; af_min_students?: number; coach_response_days?: number; coach_sees_score?: boolean };
  coach: { name: string; lob?: string | null; level?: string | null; phone?: string | null };
  template: { id?: string; name: string; code: string; scoring?: string | null; has_student_grid?: boolean };
  coordinator: { name: string };
  monitoring: {
    id: string; class_date: string | null; qa_date: string | null; syllabus?: string | null;
    schedule?: string | null; level?: string | null; status: string; base_score: number | null;
    bonus_total: number | null; penalty_applied: boolean; final_score: number | null;
    result_phrase: string | null; customer_expectation: string | null; kudos: JsonValue;
    aois: JsonValue; main_aoi: string | null; previous_aois: JsonValue; transcript_metrics: Metrics | null;
    general_comments: string | null; share_token?: string | null; zoom_link?: string | null;
    recording_start_time?: string | null; class_timeline?: JsonValue; previous_commitment_status?: CommitmentStatus | null;
    coach_summary?: string | null; coach_commitment?: string | null; coach_counter?: string | null; coach_responded_at?: string | null;
    created_at?: string; updated_at?: string;
  };
  answers: Array<MonitoringAnswer & { id?: string; item: MonitoringItem }>;
  students: Array<{ student_number: number | null; student_name: string | null; gr: number | null; pr: number | null; fl: number | null; co: number | null; in: number | null; score: number | null; phrase: string | null; goal: boolean | null; coach_phrase: string | null; comment: string | null }>;
  previous: { id?: string; date: string | null; final_score: number | null; result_phrase?: string | null; students_pct: number | null; aois?: JsonValue; main_aoi?: string | null; coach_commitment?: string | null } | null;
  recent_scores: Array<{ date: string | null; score: number; phrase?: string | null }>;
}
