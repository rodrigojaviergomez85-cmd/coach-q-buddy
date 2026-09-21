import type { ClassPhase, ClassPhaseKind } from "./monitoring";
import type { Segment, SpeakerRole } from "./transcript";

export interface MonthlyAlertInput {
  monitored: number;
  target: number;
  latestScore: number | null;
  previousScore: number | null;
  repeatedAoiCount: number;
  pendingResponseDays: number | null;
  responseLimitDays: number;
}

export function buildPhases(starts: Partial<Record<ClassPhaseKind, number>>, duration: number): ClassPhase[] {
  const order: ClassPhaseKind[] = ["inicio", "contenido", "break", "af", "cierre"];
  const points = order.flatMap((kind) => starts[kind] == null ? [] : [{ kind, start: Math.max(0, Math.min(duration, starts[kind] ?? 0)) }]).sort((a, b) => a.start - b.start);
  return points.map((phase, index) => ({ ...phase, end: points[index + 1]?.start ?? duration })).filter((phase) => phase.end > phase.start);
}

export function studentsSpeakingInPhase(segments: Segment[], roles: SpeakerRole[], phase: ClassPhase | undefined): string[] {
  if (!phase) return [];
  const studentKeys = new Set(roles.filter((role) => role.role === "alumno").map((role) => role.key));
  return [...new Set(segments.filter((segment) => segment.end > phase.start && segment.start < phase.end && studentKeys.has(segment.speakerKey)).map((segment) => segment.speaker))].sort();
}

export function monthlyAlerts(input: MonthlyAlertInput): string[] {
  const alerts: string[] = [];
  if (input.monitored < input.target) alerts.push("Meta mensual pendiente");
  if (input.latestScore != null && input.latestScore < 7) alerts.push("Puntaje bajo");
  if (input.latestScore != null && input.previousScore != null && input.latestScore < input.previousScore) alerts.push("Tendencia a la baja");
  if (input.repeatedAoiCount >= 2) alerts.push("AOI recurrente");
  if (input.pendingResponseDays != null && input.pendingResponseDays > input.responseLimitDays) alerts.push("Respuesta del coach pendiente");
  return alerts;
}