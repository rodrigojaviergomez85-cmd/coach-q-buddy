import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Download, Link2, Pencil, Save, Share2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AreaBar, ScoreCircle, StudentBars, TalkTimePie, TrafficLight } from "@/components/monitoring/ReportVisuals";
import { supabase } from "@/integrations/supabase/client";
import { formatDateSV } from "@/lib/date";
import { round2 } from "@/lib/scoring";
import { zoomMarkerUrl } from "@/lib/monitoring";
import type { BettyDeterministic, Quote } from "@/lib/betty-metrics";
import type { Metrics } from "@/lib/transcript";
import { cn } from "@/lib/utils";

type FinalResult = "si" | "no" | "na" | "";

interface AnswerRow {
  id: string;
  item_id: string;
  ai_result: string | null;
  ai_score: number | null;
  ai_confidence: string | null;
  ai_evidence: Quote[];
  ai_note: string | null;
  final_result: FinalResult;
  final_score: number | null;
  coordinator_changed: boolean;
  comment: string | null;
  item: {
    id: string; kind: string | null; area: string | null; item_number: string | null;
    short_label: string | null; description: string; points: number | null;
    area_points: number | null; sort_order: number | null; ai_mode: string | null;
  };
}

const resultBadge: Record<string, string> = {
  si: "bg-success/15 text-success",
  parcial: "bg-warning/20 text-warning-foreground",
  no: "bg-destructive/15 text-destructive",
  nd: "bg-muted text-muted-foreground",
};
const resultLabel: Record<string, string> = { si: "Sí", parcial: "Parcial", no: "No", nd: "No determinable" };

function Confidence({ level }: { level: string | null }) {
  const filled = level === "alta" ? 3 : level === "media" ? 2 : 1;
  return (
    <span className="inline-flex gap-0.5" title={`Confianza ${level ?? "baja"}`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={cn("size-1.5 rounded-full", i < filled ? "bg-foreground/70" : "bg-muted-foreground/25")} />
      ))}
    </span>
  );
}

export function BettyResult({ scanId }: { scanId: string }) {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<AnswerRow[]>([]);
  const [kudos, setKudos] = useState("");
  const [aois, setAois] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["betty-scan", scanId],
    queryFn: async () => {
      const [scanRes, answersRes, configRes] = await Promise.all([
        supabase.from("betty_scans").select("*, coach:coaches(id, full_name, lob, level)").eq("id", scanId).maybeSingle(),
        supabase.from("betty_scan_answers").select("*, item:template_items(*)").eq("scan_id", scanId),
        supabase.from("app_config").select("key, value").in("key", ["talk_time_green", "talk_time_yellow", "student_min_pct"]),
      ]);
      if (scanRes.error) throw scanRes.error;
      const cfg = Object.fromEntries((configRes.data ?? []).map((r) => [r.key, Number(r.value)]));
      return {
        scan: scanRes.data,
        answers: (answersRes.data ?? []) as unknown as AnswerRow[],
        config: {
          talk_time_green: cfg["talk_time_green"] ?? 70,
          talk_time_yellow: cfg["talk_time_yellow"] ?? 55,
          student_min_pct: cfg["student_min_pct"] ?? 8,
        },
      };
    },
  });

  useEffect(() => {
    if (!data) return;
    setAnswers(
      [...data.answers].sort((a, b) => (a.item?.sort_order ?? 0) - (b.item?.sort_order ?? 0)).map((a) => ({
        ...a,
        ai_evidence: Array.isArray(a.ai_evidence) ? a.ai_evidence : [],
        final_result: (a.final_result ?? "") as FinalResult,
      })),
    );
    setKudos((data.scan?.ai_kudos as string[] | null ?? []).join("\n"));
    setAois((data.scan?.ai_aois as string[] | null ?? []).join("\n"));
  }, [data]);

  const scan = data?.scan;
  const det = (scan?.deterministic ?? null) as BettyDeterministic | null;
  const metrics = (scan?.transcript_metrics ?? null) as Metrics | null;
  const coach = scan?.coach as { id: string; full_name: string; lob: string | null; level: string | null } | null;
  const watch = (scan?.ai_watch_minutes ?? []) as Array<{ from?: string; to?: string; why?: string }>;

  const items = answers.filter((a) => a.item?.kind === "item" || a.item?.kind === "checklist");
  const flags = answers.filter((a) => a.item?.kind === "penalty" || a.item?.kind === "bonus");

  const areas = useMemo(() => {
    const map = new Map<string, { earned: number; possible: number; rows: AnswerRow[] }>();
    for (const a of items) {
      const key = a.item?.area ?? "General";
      const current = map.get(key) ?? { earned: 0, possible: 0, rows: [] };
      current.rows.push(a);
      current.possible += Number(a.item?.points ?? 0);
      const points = Number(a.item?.points ?? 0);
      const score = a.final_result === "si" ? points : a.final_result === "no" ? 0 : Number(a.final_score ?? a.ai_score ?? 0);
      current.earned += score;
      map.set(key, current);
    }
    return [...map.entries()];
  }, [items]);

  function update(id: string, patch: Partial<AnswerRow>) {
    setAnswers((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function setResult(row: AnswerRow, value: FinalResult) {
    const points = Number(row.item?.points ?? 0);
    update(row.id, {
      final_result: value,
      final_score: value === "si" ? points : value === "no" ? 0 : null,
      coordinator_changed: true,
    });
  }

  const reviewScore = useMemo(() => {
    const total = items.reduce((sum, a) => sum + Number(a.item?.points ?? 0), 0);
    const gained = items.reduce((sum, a) => sum + Number(a.final_score ?? a.ai_score ?? 0), 0);
    return total > 0 ? round2((10 * gained) / total) : 0;
  }, [items]);

  async function saveReview() {
    setSaving(true);
    try {
      await Promise.all(
        answers.map((a) =>
          supabase
            .from("betty_scan_answers")
            .update({
              final_result: a.final_result === "" ? null : a.final_result,
              final_score: a.final_score,
              coordinator_changed: a.coordinator_changed,
              comment: a.comment,
            })
            .eq("id", a.id),
        ),
      );
      const { error } = await supabase
        .from("betty_scans")
        .update({
          status: "revisado",
          betty_score: reviewScore,
          ai_kudos: kudos.split("\n").filter((l) => l.trim()) as never,
          ai_aois: aois.split("\n").filter((l) => l.trim()) as never,
        })
        .eq("id", scanId);
      if (error) throw error;
      toast.success("Revisión guardada");
      void refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function share() {
    try {
      const token = scan?.share_token ?? crypto.randomUUID();
      if (!scan?.share_token) {
        const { error } = await supabase.from("betty_scans").update({ share_token: token }).eq("id", scanId);
        if (error) throw error;
      }
      const url = `${window.location.origin}/b/${token}`;
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado para el coach");
      void refetch();
    } catch {
      toast.error("No se pudo generar el link");
    }
  }

  async function convert() {
    if (!scan || !coach) return;
    try {
      const { data: monitoring, error } = await supabase
        .from("monitorings")
        .insert({
          coach_id: coach.id,
          coordinator_id: scan.coordinator_id,
          template_id: scan.template_id,
          class_date: scan.class_date,
          qa_date: scan.class_date,
          level: scan.level,
          zoom_link: scan.zoom_link,
          status: "borrador",
          transcript_raw: scan.transcript_raw,
          transcript_metrics: scan.transcript_metrics as never,
          class_timeline: scan.class_timeline as never,
          kudos: kudos.split("\n").filter((l) => l.trim()) as never,
          aois: aois.split("\n").filter((l) => l.trim()).map((text) => ({ text })) as never,
        })
        .select("id")
        .single();
      if (error) throw error;

      const rows = answers
        .filter((a) => a.final_result === "si" || a.final_result === "no" || a.final_result === "na")
        .map((a) => ({
          monitoring_id: monitoring.id,
          item_id: a.item_id,
          result: a.final_result as "si" | "no" | "na",
          comment: [a.ai_note ?? "", ...a.ai_evidence.map((e) => `[${e.m}] «${e.quote}»`)].filter(Boolean).join(" · ") || null,
        }));
      if (rows.length > 0) await supabase.from("monitoring_answers").insert(rows);

      await supabase
        .from("betty_scans")
        .update({ status: "convertido", converted_monitoring_id: monitoring.id })
        .eq("id", scanId);

      toast.success("Monitoreo creado en borrador");
      void navigate({ to: "/monitoreos/$id/editar", params: { id: monitoring.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo convertir");
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({ scan, answers }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `betty-${scanId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) return <p className="text-muted-foreground">Cargando análisis…</p>;
  if (!scan) return <p className="text-muted-foreground">No encontré este análisis.</p>;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-warning bg-warning/15 px-4 py-3 text-sm font-semibold">
        Análisis de Coach Betty Well · auxiliar, no oficial
      </div>

      <section className="flex flex-wrap items-center gap-5 rounded-xl border bg-card p-5">
        <ScoreCircle score={scan.betty_score} phrase={scan.betty_phrase} />
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-xl font-bold">{coach?.full_name ?? "Coach"}</h1>
          <p className="text-sm text-muted-foreground">
            {scan.class_date ? formatDateSV(scan.class_date) : "—"} · {scan.level ?? "—"} · {scan.lob ?? coach?.lob ?? "—"}
          </p>
          {scan.ai_summary ? <p className="pt-1 text-sm">{scan.ai_summary}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void saveReview()} disabled={saving}><Save className="mr-2 size-4" />Guardar revisión</Button>
          <Button variant="outline" onClick={() => void convert()}><Sparkles className="mr-2 size-4" />Convertir en monitoreo</Button>
          <Button variant="outline" onClick={() => void share()}><Share2 className="mr-2 size-4" />Compartir con el coach</Button>
          <Button variant="outline" onClick={exportJson}><Download className="mr-2 size-4" />Exportar</Button>
        </div>
      </section>

      {watch.length > 0 ? (
        <section className="space-y-2 rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Minutos para ver</h2>
          <div className="flex flex-wrap gap-2">
            {watch.map((w, i) => {
              const seconds = (() => {
                const parts = String(w.from ?? "").split(":").map(Number);
                return parts.length === 2 && parts.every(Number.isFinite) ? parts[0]! * 60 + parts[1]! : null;
              })();
              const href = zoomMarkerUrl(scan.zoom_link, seconds);
              const label = `⏱ ${w.from ?? "—"}–${w.to ?? "—"} · ${w.why ?? ""}`;
              return href ? (
                <a key={i} href={href} target="_blank" rel="noreferrer" className="rounded-full bg-muted px-3 py-1 text-xs hover:bg-muted/70">{label}</a>
              ) : (
                <span key={i} className="rounded-full bg-muted px-3 py-1 text-xs">{label}</span>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        {areas.map(([area, group]) => (
          <div key={area} className="space-y-3 rounded-xl border bg-card p-5">
            <AreaBar name={area} earned={group.earned} possible={group.possible} />
            <div className="divide-y">
              {group.rows.map((row) => (
                <div key={row.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto]">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{row.item?.item_number ?? row.item?.short_label ?? ""}</span>
                      <Badge className={resultBadge[row.ai_result ?? "nd"]} variant="secondary">
                        {resultLabel[row.ai_result ?? "nd"]}
                      </Badge>
                      <Confidence level={row.ai_confidence} />
                      {row.coordinator_changed ? <Pencil className="size-3.5 text-muted-foreground" /> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">{row.item?.description}</p>
                    {row.ai_note ? <p className="text-xs text-muted-foreground">{row.ai_note}</p> : null}
                    <div className="flex flex-wrap gap-1.5">
                      {row.ai_evidence.slice(0, 3).map((e, i) => (
                        <span key={i} className="max-w-full truncate rounded-full bg-muted px-2 py-0.5 text-xs" title={e.quote}>
                          ⏱ {e.m} «{e.quote}»
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-start gap-1">
                    {(["si", "no", "na"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setResult(row, value)}
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-xs font-semibold",
                          row.final_result === value ? "border-primary bg-primary text-primary-foreground" : "bg-background",
                        )}
                      >
                        {value === "si" ? "Sí" : value === "no" ? "No" : "N/A"}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {flags.length > 0 ? (
        <section className="space-y-3 rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Penalidades y bonus sugeridos</h2>
          {flags.map((row) => (
            <div key={row.id} className="flex items-start justify-between gap-3 border-t py-2 first:border-t-0">
              <div className="min-w-0">
                <p className="text-sm font-medium">{row.item?.description}</p>
                {row.ai_note ? <p className="text-xs text-muted-foreground">{row.ai_note}</p> : null}
                {row.ai_evidence.slice(0, 2).map((e, i) => (
                  <p key={i} className="text-xs text-muted-foreground">⏱ {e.m} «{e.quote}»</p>
                ))}
              </div>
              <Switch
                checked={row.final_result === "si"}
                onCheckedChange={(checked) => setResult(row, checked ? "si" : "no")}
              />
            </div>
          ))}
        </section>
      ) : null}

      {metrics ? (
        <section className="grid gap-5 rounded-xl border bg-card p-5 lg:grid-cols-2">
          <div>
            <h2 className="mb-2 font-semibold">¿Quién habló en la clase?</h2>
            <TalkTimePie metrics={metrics} />
            <TrafficLight light={metrics.traffic_light} label={`Alumnos ${metrics.students_pct} %`} />
          </div>
          <div>
            <h2 className="mb-2 font-semibold">Participación por alumno</h2>
            <StudentBars metrics={metrics} minimum={data?.config.student_min_pct ?? 8} />
          </div>
        </section>
      ) : null}

      {det ? (
        <section className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-2xl font-bold">{det.coach_spanish_pct} %</p>
            <p className="text-sm text-muted-foreground">Español del coach</p>
            {det.spanish_examples.slice(0, 3).map((q, i) => (
              <p key={i} className="mt-1 text-xs text-muted-foreground">⏱ {q.m} «{q.quote}»</p>
            ))}
          </div>
          <div>
            <p className="text-2xl font-bold">{det.affirmations.count}</p>
            <p className="text-sm text-muted-foreground">Afirmaciones</p>
            <p className="text-xs text-muted-foreground">{det.affirmations.minutes.slice(0, 6).join(" · ")}</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{det.boosters.count}</p>
            <p className="text-sm text-muted-foreground">Boosters</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{det.expansion.students}</p>
            <p className="text-sm text-muted-foreground">Alumnos con expansión · {det.expansion.coach_push_count} empujes</p>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
        <div className="space-y-2">
          <h2 className="font-semibold">Kudos de Betty</h2>
          <Textarea rows={4} value={kudos} onChange={(e) => setKudos(e.target.value)} placeholder="Un kudo por línea" />
        </div>
        <div className="space-y-2">
          <h2 className="font-semibold">AOIs de Betty</h2>
          <Textarea rows={4} value={aois} onChange={(e) => setAois(e.target.value)} placeholder="Un AOI por línea" />
        </div>
      </section>

      {scan.share_token ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link2 className="size-4" /> Link del coach: /b/{scan.share_token}
        </p>
      ) : null}
    </div>
  );
}
