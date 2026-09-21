import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, Eye, Pencil, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/auth";
import { formatDateSV, todaySV } from "@/lib/date";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/monitoreos/")({
  head: () => ({ meta: [{ title: "Monitoreos · QA Coaches E4K" }, { name: "description", content: "Monitoreos de clases, puntajes y estado." }, { property: "og:title", content: "Monitoreos · QA Coaches E4K" }, { property: "og:description", content: "Monitoreos de clases, puntajes y estado." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: MonitoringsPage,
});

function currentMonth() { return todaySV().slice(0, 7); }
function monthBounds(month: string) { const [year, value] = month.split("-").map(Number); if (!year || !value) return null; const next = new Date(Date.UTC(year, value, 1)).toISOString().slice(0, 10); return { from: `${month}-01`, to: next }; }

function MonitoringsPage() {
  const { profile, canSeeAll } = useProfile();
  const [month, setMonth] = useState(currentMonth());
  const [coach, setCoach] = useState("all");
  const [template, setTemplate] = useState("all");
  const [status, setStatus] = useState("all");
  const query = useQuery({ queryKey: ["monitorings", month], queryFn: async () => {
    const bounds = monthBounds(month);
    let request = supabase.from("monitorings").select("id,coach_id,coordinator_id,template_id,class_date,qa_date,status,final_score,result_phrase,created_at,updated_at,coach:coaches(full_name),template:templates(name,code)").order("class_date", { ascending: false }).order("created_at", { ascending: false });
    if (bounds) request = request.gte("class_date", bounds.from).lt("class_date", bounds.to);
    const { data, error } = await request; if (error) throw error; return data ?? [];
  }});
  const rows = useMemo(() => (query.data ?? []).filter((m) => (coach === "all" || m.coach_id === coach) && (template === "all" || m.template_id === template) && (status === "all" || m.status === status)), [coach, query.data, status, template]);
  const coaches = useMemo(() => Array.from(new Map((query.data ?? []).map((m) => [m.coach_id, { id: m.coach_id, name: m.coach?.full_name ?? "Coach" }])).values()).filter((c) => c.id), [query.data]);
  const templates = useMemo(() => Array.from(new Map((query.data ?? []).map((m) => [m.template_id, { id: m.template_id, name: m.template?.name ?? "Plantilla" }])).values()).filter((t) => t.id), [query.data]);
  function canEdit(row: { coordinator_id: string | null; status: string; updated_at: string }) { if (canSeeAll) return true; if (row.coordinator_id !== profile.id) return false; return row.status === "borrador" || Date.now() - new Date(row.updated_at).getTime() <= 48 * 60 * 60 * 1000; }
  return <>
    <PageHeader title="Monitoreos" subtitle="Consulta resultados o continúa tus borradores." actions={<Button asChild><Link to="/monitoreos/nuevo"><Plus className="size-4" /> Nuevo monitoreo</Link></Button>} />
    <div className="mb-5 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4"><Input aria-label="Mes" type="month" value={month} onChange={(e) => setMonth(e.target.value)} /><Select value={coach} onValueChange={setCoach}><SelectTrigger><SelectValue placeholder="Coach" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los coaches</SelectItem>{coaches.map((c) => <SelectItem key={c.id} value={c.id ?? ""}>{c.name}</SelectItem>)}</SelectContent></Select><Select value={template} onValueChange={setTemplate}><SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los tipos</SelectItem>{templates.map((t) => <SelectItem key={t.id} value={t.id ?? ""}>{t.name}</SelectItem>)}</SelectContent></Select><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los estados</SelectItem><SelectItem value="borrador">Borrador</SelectItem><SelectItem value="enviado">Enviado</SelectItem></SelectContent></Select></div>
    {query.isLoading ? <p className="text-sm text-muted-foreground">Cargando monitoreos…</p> : query.isError ? <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center text-sm text-destructive">No se pudo cargar la lista.</div> : rows.length === 0 ? <div className="flex flex-col items-center rounded-xl border border-dashed bg-card/60 px-6 py-16 text-center"><span className="grid size-12 place-items-center rounded-2xl bg-muted"><ClipboardList className="size-6 text-muted-foreground" /></span><h2 className="mt-4 font-semibold">No hay monitoreos para estos filtros</h2><p className="mt-1 text-sm text-muted-foreground">Cambia el mes o crea el primer monitoreo.</p><Button asChild className="mt-5"><Link to="/monitoreos/nuevo"><Plus className="size-4" /> Nuevo monitoreo</Link></Button></div> : <div className="rounded-xl border bg-card"><Table><TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Coach</TableHead><TableHead>Tipo</TableHead><TableHead>Puntaje</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader><TableBody>{rows.map((m) => <TableRow key={m.id}><TableCell>{formatDateSV(m.class_date)}</TableCell><TableCell className="font-semibold">{m.coach?.full_name ?? "—"}</TableCell><TableCell><p>{m.template?.name ?? "—"}</p><p className="text-xs text-muted-foreground">{m.result_phrase}</p></TableCell><TableCell><span className={cn("text-lg font-bold", (m.final_score ?? 0) >= 9 ? "text-success" : (m.final_score ?? 0) >= 7 ? "text-warning-foreground" : "text-destructive")}>{m.final_score?.toFixed(1) ?? "—"}</span></TableCell><TableCell><Badge variant={m.status === "enviado" ? "default" : "secondary"}>{m.status === "enviado" ? "Enviado" : "Borrador"}</Badge></TableCell><TableCell><div className="flex justify-end gap-1"><Button asChild size="icon" variant="ghost" title="Abrir"><Link to="/monitoreos/$id" params={{ id: m.id }}><Eye className="size-4" /></Link></Button>{canEdit(m) ? <Button asChild size="icon" variant="ghost" title="Editar"><Link to="/monitoreos/$id/editar" params={{ id: m.id }}><Pencil className="size-4" /></Link></Button> : null}</div></TableCell></TableRow>)}</TableBody></Table></div>}
  </>;
}