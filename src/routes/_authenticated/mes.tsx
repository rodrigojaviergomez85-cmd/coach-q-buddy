import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Download, Gauge, MessageCircleWarning, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/auth";
import { monthlyAlerts } from "@/lib/follow-up";
import { normalizeAois } from "@/lib/monitoring";
import { todaySV } from "@/lib/date";

export const Route = createFileRoute("/_authenticated/mes")({
  head: () => ({ meta: [{ title: "Vista mensual · QA Coaches E4K" }, { name: "description", content: "Avance mensual, resultados y alertas de coaches." }, { property: "og:title", content: "Vista mensual · QA Coaches E4K" }, { property: "og:description", content: "Avance mensual, resultados y alertas de coaches." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: MonthlyPage,
});

function bounds(month: string) { const [y, m] = month.split("-").map(Number); return { from: `${month}-01`, to: new Date(Date.UTC(y || 2000, m || 1, 1)).toISOString().slice(0, 10) }; }

function MonthlyPage() {
  const { canSeeAll } = useProfile();
  const [month, setMonth] = useState(todaySV().slice(0, 7));
  const [coordinator, setCoordinator] = useState("all");
  const query = useQuery({ queryKey: ["monthly-dashboard", month], queryFn: async () => {
    const range = bounds(month);
    const [coaches, monitorings, profiles, config] = await Promise.all([
      supabase.from("coaches").select("id,full_name,lob,level,coordinator_id,active").eq("active", true).order("full_name"),
      supabase.from("monitorings").select("id,coach_id,coordinator_id,class_date,qa_date,final_score,aois,main_aoi,coach_responded_at,created_at,template:templates(name)").eq("status", "enviado").gte("qa_date", range.from).lt("qa_date", range.to).order("created_at", { ascending: true }),
      supabase.from("profiles").select("id,full_name,email").order("full_name"),
      supabase.from("app_config").select("key,value").in("key", ["monthly_target", "coach_response_days"]),
    ]);
    for (const result of [coaches, monitorings, profiles, config]) if (result.error) throw result.error;
    return { coaches: coaches.data ?? [], monitorings: monitorings.data ?? [], profiles: profiles.data ?? [], config: Object.fromEntries((config.data ?? []).map((r) => [r.key, Number(r.value)])) };
  }});
  const rows = useMemo(() => {
    const data = query.data; if (!data) return [];
    const target = data.config["monthly_target"] ?? 2;
    const limit = data.config["coach_response_days"] ?? 3;
    return data.coaches.filter((coach) => coordinator === "all" || coach.coordinator_id === coordinator).map((coach) => {
      const list = data.monitorings.filter((m) => m.coach_id === coach.id);
      const scores = list.flatMap((m) => m.final_score == null ? [] : [Number(m.final_score)]);
      const aoiCounts = new Map<string, number>(); for (const m of list) for (const a of normalizeAois(m.aois)) { const key = a.text.trim().toLowerCase(); aoiCounts.set(key, (aoiCounts.get(key) ?? 0) + 1); }
      const latest = list.at(-1); const previous = list.at(-2); const pending = list.find((m) => !m.coach_responded_at);
      const pendingDays = pending ? Math.floor((Date.now() - new Date(pending.created_at).getTime()) / 86400000) : null;
      return { coach, list, average: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null, latest: latest?.final_score == null ? null : Number(latest.final_score), alerts: monthlyAlerts({ monitored: list.length, target, latestScore: latest?.final_score == null ? null : Number(latest.final_score), previousScore: previous?.final_score == null ? null : Number(previous.final_score), repeatedAoiCount: Math.max(0, ...aoiCounts.values()), pendingResponseDays: pendingDays, responseLimitDays: limit }) };
    });
  }, [coordinator, query.data]);
  const profiles = query.data?.profiles ?? [];
  const total = rows.reduce((sum, row) => sum + row.list.length, 0); const target = (query.data?.config["monthly_target"] ?? 2) * rows.length;
  async function exportExcel() { const XLSX = await import("xlsx"); const details = rows.flatMap((row) => row.list.map((m) => ({ Coach: row.coach.full_name, Fecha: m.class_date, Plantilla: m.template?.name ?? "", Puntaje: m.final_score, "Coach respondió": m.coach_responded_at ? "Sí" : "No" }))); const summary = rows.map((row) => ({ Coach: row.coach.full_name, LOB: row.coach.lob, Monitoreos: row.list.length, Promedio: row.average, Alertas: row.alerts.join(", ") })); const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(details), "Monitoreos"); XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(summary), "Resumen por coach"); XLSX.writeFile(book, `QA-${month}.xlsx`); }
  return <><PageHeader title="Vista mensual" subtitle="Avance, resultados y alertas del equipo." actions={<Button variant="outline" onClick={() => void exportExcel()}><Download className="size-4" /> Exportar Excel</Button>} /><div className="mb-5 grid gap-3 sm:grid-cols-2"><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />{canSeeAll ? <Select value={coordinator} onValueChange={setCoordinator}><SelectTrigger><SelectValue placeholder="Coordinador" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los coordinadores</SelectItem>{profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>)}</SelectContent></Select> : null}</div><div className="mb-6 grid gap-3 sm:grid-cols-3"><Kpi icon={Gauge} label="Avance del mes" value={`${total} / ${target}`}><Progress value={target ? total / target * 100 : 0} className="mt-3" /></Kpi><Kpi icon={Users} label="Coaches activos" value={String(rows.length)} /><Kpi icon={AlertTriangle} label="Coaches con alertas" value={String(rows.filter((r) => r.alerts.length).length)} /></div>{query.isLoading ? <p className="text-sm text-muted-foreground">Cargando mes…</p> : <div className="overflow-x-auto rounded-lg border bg-card"><table className="w-full text-sm"><thead className="bg-muted"><tr><th className="p-3 text-left">Coach</th><th className="p-3 text-left">Avance</th><th className="p-3 text-left">Promedio</th><th className="p-3 text-left">Último</th><th className="p-3 text-left">Alertas</th></tr></thead><tbody>{rows.map((row) => <tr key={row.coach.id} className="border-t"><td className="p-3"><Link to="/coaches/$coachId" params={{ coachId: row.coach.id }} className="font-semibold text-primary">{row.coach.full_name}</Link><p className="text-xs text-muted-foreground">{row.coach.lob || "—"}</p></td><td className="p-3 font-semibold">{row.list.length} / {query.data?.config["monthly_target"] ?? 2}</td><td className="p-3 text-lg font-bold">{row.average?.toFixed(1) ?? "—"}</td><td className="p-3 text-lg font-bold">{row.latest?.toFixed(1) ?? "—"}</td><td className="p-3"><div className="flex flex-wrap gap-1">{row.alerts.length ? row.alerts.map((alert) => <Badge key={alert} variant="outline" className="gap-1"><MessageCircleWarning className="size-3" />{alert}</Badge>) : <Badge>Al día</Badge>}</div></td></tr>)}</tbody></table></div>}</>;
}

function Kpi({ icon: Icon, label, value, children }: { icon: typeof Gauge; label: string; value: string; children?: React.ReactNode }) { return <div className="rounded-lg border bg-card p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="size-4" />{label}</div><p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>{children}</div>; }