import { supabase } from "@/integrations/supabase/client";
import type { ReportData } from "./monitoring";

export async function fetchInternalReport(id: string): Promise<ReportData | null> {
  const { data: m, error } = await supabase.from("monitorings").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!m) return null;
  const [{ data: coach }, { data: template }, { data: profile }, { data: answers }, { data: students }, { data: previous }, { data: recent }, { data: configRows }] = await Promise.all([
    supabase.from("coaches").select("full_name, lob, level").eq("id", m.coach_id ?? "").maybeSingle(),
    supabase.from("templates").select("id, name, code, scoring, has_student_grid").eq("id", m.template_id ?? "").maybeSingle(),
    supabase.from("profiles").select("full_name, email").eq("id", m.coordinator_id ?? "").maybeSingle(),
    supabase.from("monitoring_answers").select("id, item_id, result, score, comment, evidence_time, item:template_items(*)").eq("monitoring_id", id),
    supabase.from("monitoring_students").select("*").eq("monitoring_id", id).order("student_number"),
    supabase.from("monitorings").select("id, class_date, final_score, transcript_metrics, aois, main_aoi, coach_commitment").eq("coach_id", m.coach_id ?? "").eq("status", "enviado").neq("id", id).lt("created_at", m.created_at).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("monitorings").select("class_date, final_score, created_at").eq("coach_id", m.coach_id ?? "").eq("status", "enviado").not("final_score", "is", null).lte("created_at", m.created_at).order("created_at", { ascending: false }).limit(6),
    supabase.from("app_config").select("key,value").in("key", ["talk_time_green", "talk_time_yellow", "student_min_pct", "af_min_students", "coach_response_days"]),
  ]);
  const prevMetrics = previous?.transcript_metrics as { students_pct?: number } | null;
  const config = Object.fromEntries((configRows ?? []).map((row) => [row.key, Number(row.value)]));
  return {
    config: { talk_time_green: config["talk_time_green"] ?? 70, talk_time_yellow: config["talk_time_yellow"] ?? 55, student_min_pct: config["student_min_pct"] ?? 8, af_min_students: config["af_min_students"] ?? 3, coach_response_days: config["coach_response_days"] ?? 3 },
    coach: { name: coach?.full_name ?? "Coach", lob: coach?.lob ?? null, level: coach?.level ?? null },
    template: { id: template?.id ?? "", name: template?.name ?? "Monitoreo", code: template?.code ?? "", scoring: template?.scoring ?? null, has_student_grid: template?.has_student_grid ?? false },
    coordinator: { name: profile?.full_name || profile?.email || "—" },
    monitoring: m as unknown as ReportData["monitoring"],
    answers: (answers ?? []).filter((a) => a.item && a.item_id).map((a) => ({ ...a, item_id: a.item_id ?? "", result: a.result as "si" | "no" | "na", comment: a.comment ?? "", evidence_time: a.evidence_time, item: a.item as unknown as ReportData["answers"][number]["item"] })),
    students: students ?? [],
    previous: previous ? { id: previous.id, date: previous.class_date, final_score: previous.final_score, students_pct: prevMetrics?.students_pct ?? null, aois: previous.aois, main_aoi: previous.main_aoi, coach_commitment: previous.coach_commitment } : null,
    recent_scores: (recent ?? []).reverse().map((r) => ({ date: r.class_date, score: Number(r.final_score) })),
  };
}