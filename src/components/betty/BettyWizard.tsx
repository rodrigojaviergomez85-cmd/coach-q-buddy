import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TranscriptAnalyzer } from "@/components/transcript/TranscriptAnalyzer";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/auth";
import { todaySV } from "@/lib/date";
import { analyzeBettyScan } from "@/lib/betty.functions";
import {
  computeDeterministic,
  transcriptHash,
  type BettyDeterministic,
} from "@/lib/betty-metrics";
import type { Metrics, Segment, SpeakerRole } from "@/lib/transcript";

interface Coach { id: string; full_name: string; lob: string | null; level: string | null }
interface Template { id: string; name: string; code: string }

const LEVELS = Array.from({ length: 13 }, (_, i) => `Level ${i}`);

export function BettyWizard() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [step, setStep] = useState(1);
  const [running, setRunning] = useState(false);
  const [form, setForm] = useState({
    coach_id: "",
    template_id: "",
    class_date: todaySV(),
    level: "",
    zoom_link: "",
  });
  const [raw, setRaw] = useState("");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [det, setDet] = useState<BettyDeterministic | null>(null);

  const setup = useQuery({
    queryKey: ["betty-setup"],
    queryFn: async () => {
      const [coaches, items] = await Promise.all([
        supabase.from("coaches").select("id, full_name, lob, level").eq("active", true).order("full_name"),
        supabase.from("template_items").select("template_id, ai_mode, template:templates(id, name, code, active)").neq("ai_mode", "manual"),
      ]);
      if (coaches.error) throw coaches.error;
      if (items.error) throw items.error;
      const templates = new Map<string, Template>();
      for (const row of items.data ?? []) {
        const t = row.template as unknown as (Template & { active: boolean }) | null;
        if (t?.id && t.active) templates.set(t.id, { id: t.id, name: t.name, code: t.code });
      }
      return { coaches: (coaches.data ?? []) as Coach[], templates: [...templates.values()] };
    },
  });

  const coach = setup.data?.coaches.find((c) => c.id === form.coach_id);

  function handleMetrics(
    next: Metrics,
    text: string,
    ctx?: { segments: Segment[]; roles: SpeakerRole[] },
  ) {
    setMetrics(next);
    setRaw(text);
    if (ctx) setDet(computeDeterministic(ctx.segments, ctx.roles, next));
  }

  async function run() {
    if (!coach || !form.template_id || !det || !metrics) return;
    setRunning(true);
    try {
      const [{ data: limitRow }, { count: todayCount }] = await Promise.all([
        supabase.from("app_config").select("value").eq("key", "betty_daily_limit").maybeSingle(),
        supabase
          .from("betty_scans")
          .select("id", { count: "exact", head: true })
          .eq("coordinator_id", profile.id)
          .gte("created_at", `${todaySV()}T00:00:00`),
      ]);
      const limit = Number(limitRow?.value ?? 30);
      if ((todayCount ?? 0) >= limit) {
        toast.error(`Ya usaste tus ${limit} análisis de hoy.`);
        return;
      }

      const hash = transcriptHash(raw);
      const { data: existing } = await supabase
        .from("betty_scans")
        .select("id")
        .eq("coach_id", coach.id)
        .eq("transcript_hash", hash)
        .maybeSingle();
      if (existing) {
        toast.info("Ya existe un análisis de esta clase; te llevo a él.");
        void navigate({ to: "/betty/$id", params: { id: existing.id } });
        return;
      }

      const { data: scan, error } = await supabase
        .from("betty_scans")
        .insert({
          coach_id: coach.id,
          coordinator_id: profile.id,
          template_id: form.template_id,
          class_date: form.class_date,
          level: form.level || coach.level,
          lob: coach.lob,
          zoom_link: form.zoom_link || null,
          transcript_raw: raw,
          transcript_hash: hash,
          transcript_metrics: metrics as never,
          deterministic: det as never,
        })
        .select("id")
        .single();
      if (error) throw error;

      const result = await analyzeBettyScan({ data: { scan_id: scan.id } });
      if (result.ai_error) toast.warning("Betty guardó las métricas, pero la IA no respondió.");
      else toast.success("Betty terminó de leer la clase.");
      void navigate({ to: "/betty/$id", params: { id: scan.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo analizar la clase.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {["Clase", "Transcript", "Analizar"].map((label, i) => (
          <span
            key={label}
            className={`rounded-full px-3 py-1 ${step === i + 1 ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            {i + 1}. {label}
          </span>
        ))}
      </div>

      {step === 1 ? (
        <div className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Coach</Label>
            <Select value={form.coach_id} onValueChange={(v) => setForm((f) => ({ ...f, coach_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Elige un coach" /></SelectTrigger>
              <SelectContent>
                {(setup.data?.coaches ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Plantilla</Label>
            <Select value={form.template_id} onValueChange={(v) => setForm((f) => ({ ...f, template_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Elige una plantilla" /></SelectTrigger>
              <SelectContent>
                {(setup.data?.templates ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Fecha de la clase</Label>
            <Input type="date" value={form.class_date} onChange={(e) => setForm((f) => ({ ...f, class_date: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Nivel</Label>
            <Select value={form.level} onValueChange={(v) => setForm((f) => ({ ...f, level: v }))}>
              <SelectTrigger><SelectValue placeholder="Elige el nivel" /></SelectTrigger>
              <SelectContent>
                {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Link de la grabación de Zoom (opcional)</Label>
            <Input value={form.zoom_link} onChange={(e) => setForm((f) => ({ ...f, zoom_link: e.target.value }))} placeholder="https://..." />
          </div>
          <p className="text-sm text-muted-foreground sm:col-span-2">
            LOB del coach: <strong>{coach?.lob ?? "—"}</strong>
          </p>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="rounded-xl border bg-card p-5">
          <TranscriptAnalyzer onMetrics={handleMetrics} />
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4 rounded-xl border bg-card p-6 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-amber-500/15 text-lg font-bold text-amber-700">BW</div>
          <p className="text-lg font-semibold">Betty está lista para leer la clase</p>
          <p className="text-sm text-muted-foreground">
            {det ? `${det.duration_min} min · alumnos ${det.students_pct} % · español del coach ${det.coach_spanish_pct} %` : "Falta el transcript."}
          </p>
          <Button size="lg" disabled={!det || running} onClick={() => void run()}>
            <Sparkles className="mr-2 size-4" />
            {running ? "Betty está leyendo la clase…" : "Analizar con Betty"}
          </Button>
        </div>
      ) : null}

      <div className="flex justify-between">
        <Button variant="outline" disabled={step === 1} onClick={() => setStep((s) => s - 1)}>
          <ChevronLeft className="mr-1 size-4" /> Atrás
        </Button>
        <Button
          disabled={step === 3 || (step === 1 && (!form.coach_id || !form.template_id)) || (step === 2 && !det)}
          onClick={() => setStep((s) => s + 1)}
        >
          Siguiente <ChevronRight className="ml-1 size-4" />
        </Button>
      </div>
    </div>
  );
}
