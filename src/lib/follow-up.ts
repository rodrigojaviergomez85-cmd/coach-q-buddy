import type { ClassPhase, ClassPhaseKind } from "./monitoring";
import { speakerKey, type Segment, type SpeakerRole } from "./transcript";

export interface MonthlyAlertInput {
  monitored: number;
  target: number;
  latestScore: number | null;
  previousScore: number | null;
  repeatedAoiCount: number;
  pendingResponseDays: number | null;
  responseLimitDays: number;
  averageStudentsPct: number | null;
  talkTimeYellow: number;
  hasAutoFive: boolean;
}

export type MonthlyAlert = "Meta mensual pendiente" | "Puntaje bajo" | "Tendencia a la baja" | "AOI recurrente" | "Respuesta del coach pendiente" | "Coach habla de más" | "Auto 5";

export function buildPhases(starts: Partial<Record<ClassPhaseKind, number>>, duration: number): ClassPhase[] {
  const order: ClassPhaseKind[] = ["inicio", "contenido", "break", "af", "cierre"];
  const points = order.flatMap((kind) => starts[kind] == null ? [] : [{ kind, start: Math.max(0, Math.min(duration, starts[kind] ?? 0)) }]).sort((a, b) => a.start - b.start);
  return points.map((phase, index) => ({ ...phase, end: points[index + 1]?.start ?? duration })).filter((phase) => phase.end > phase.start);
}

export function studentsSpeakingInPhase(segments: Segment[], roles: SpeakerRole[], phase: ClassPhase | undefined): string[] {
  if (!phase) return [];
  const studentKeys = new Set(roles.filter((role) => role.role === "alumno").map((role) => role.key));
  return [...new Set(segments.filter((segment) => segment.end > phase.start && segment.start < phase.end && studentKeys.has(speakerKey(segment.speaker))).map((segment) => segment.speaker))].sort();
}

export function monthlyAlerts(input: MonthlyAlertInput): MonthlyAlert[] {
  const alerts: MonthlyAlert[] = [];
  if (input.monitored < input.target) alerts.push("Meta mensual pendiente");
  if (input.latestScore != null && input.latestScore < 7) alerts.push("Puntaje bajo");
  if (input.latestScore != null && input.previousScore != null && input.latestScore < input.previousScore) alerts.push("Tendencia a la baja");
  if (input.repeatedAoiCount >= 2) alerts.push("AOI recurrente");
  if (input.pendingResponseDays != null && input.pendingResponseDays > input.responseLimitDays) alerts.push("Respuesta del coach pendiente");
  if (input.averageStudentsPct != null && input.averageStudentsPct < input.talkTimeYellow) alerts.push("Coach habla de más");
  if (input.hasAutoFive) alerts.push("Auto 5");
  return alerts;
}

function isCoach(segment: Segment, roles: SpeakerRole[]): boolean {
  return roles.some((role) => role.key === speakerKey(segment.speaker) && role.role === "coach");
}

function sortedSegments(segments: Segment[]): Segment[] {
  return [...segments].sort((a, b) => a.start - b.start || a.end - b.end);
}

/** Sugiere fases usando palabras y silencios reales del transcript. Todos los tiempos están en segundos. */
export function suggestPhaseStarts(segments: Segment[], roles: SpeakerRole[], duration: number): Partial<Record<ClassPhaseKind, number>> {
  const ordered = sortedSegments(segments);
  const safeDuration = Math.max(0, duration);
  const gaps = ordered.slice(0, -1).map((segment, index) => ({ segment, start: segment.end, end: ordered[index + 1]?.start ?? segment.end })).filter((gap) => gap.end > gap.start);
  const contentGap = gaps.find((gap) => gap.start >= 3 * 60 && gap.end - gap.start >= 30);
  const breakByWord = ordered.find((segment, index) => isCoach(segment, roles) && /\bbreak\b/i.test(segment.text) && (ordered[index + 1]?.start ?? segment.end) - segment.end >= 90);
  const fallbackBreak = gaps.filter((gap) => gap.start >= 25 * 60 && gap.end <= 40 * 60).sort((a, b) => (b.end - b.start) - (a.end - a.start))[0];
  const af = ordered.find((segment) => isCoach(segment, roles) && (/automatic\s+fluency/i.test(segment.text) || /\bAF\b/i.test(segment.text)));
  const starts: Partial<Record<ClassPhaseKind, number>> = {
    inicio: 0,
    contenido: Math.min(safeDuration, contentGap?.end ?? 5 * 60),
    cierre: Math.max(0, safeDuration - 2 * 60),
  };
  const breakStart = breakByWord?.start ?? fallbackBreak?.start;
  if (breakStart != null && breakStart < safeDuration) starts.break = breakStart;
  if (af && af.start < safeDuration) starts.af = af.start;
  return starts;
}