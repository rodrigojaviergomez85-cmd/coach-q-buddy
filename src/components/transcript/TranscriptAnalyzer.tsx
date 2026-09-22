import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Copy, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  classifySpeakers,
  computeMetrics,
  metricsToCsv,
  metricsToText,
  parseTranscript,
  quickRead,
  type Metrics,
  type Segment,
  type SpeakerRole,
  type SpeakerRoleKind,
  type TranscriptConfig,
} from "@/lib/transcript";

const ROLE_OPTIONS: { value: SpeakerRoleKind; label: string }[] = [
  { value: "coach", label: "Coach" },
  { value: "alumno", label: "Alumno" },
  { value: "audio", label: "Audio" },
  { value: "ignorar", label: "Ignorar" },
];

const COACH_COLOR = "hsl(215 25% 55%)";
const STUDENT_COLOR = "hsl(152 55% 42%)";

const DEFAULT_CONFIG: TranscriptConfig = {
  talk_time_green: 70,
  talk_time_yellow: 55,
  student_min_pct: 8,
};

function useTranscriptConfig(): TranscriptConfig {
  const { data } = useQuery({
    queryKey: ["app-config-transcript"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_config").select("key, value");
      if (error) throw error;
      const map: Record<string, unknown> = {};
      for (const row of data ?? []) map[row.key] = row.value;
      const num = (key: keyof TranscriptConfig) => {
        const raw = map[key];
        const n = typeof raw === "string" ? Number(raw) : Number(raw);
        return Number.isFinite(n) ? n : DEFAULT_CONFIG[key];
      };
      return {
        talk_time_green: num("talk_time_green"),
        talk_time_yellow: num("talk_time_yellow"),
        student_min_pct: num("student_min_pct"),
      } satisfies TranscriptConfig;
    },
  });
  return data ?? DEFAULT_CONFIG;
}

function lightClass(light: Metrics["traffic_light"]): string {
  if (light === "verde") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  if (light === "amarillo") return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  return "bg-red-500/15 text-red-700 dark:text-red-300";
}

export function TranscriptAnalyzer({
  onMetrics,
}: {
  onMetrics?: (
    metrics: Metrics,
    rawText: string,
    context?: { segments: Segment[]; roles: SpeakerRole[] },
  ) => void;
}) {
  const config = useTranscriptConfig();
  const fileRef = useRef<HTMLInputElement>(null);

  const [raw, setRaw] = useState("");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [roles, setRoles] = useState<SpeakerRole[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  function handleText(text: string) {
    setRaw(text);
    setMetrics(null);
    if (!text.trim()) {
      setSegments([]);
      setRoles([]);
      setParseError(null);
      return;
    }
    const parsed = parseTranscript(text);
    if (parsed.length === 0) {
      setSegments([]);
      setRoles([]);
      setParseError(
        "No reconozco el formato. Pega el .vtt de Zoom o el texto del panel Audio Transcript.",
      );
      return;
    }
    setParseError(null);
    setSegments(parsed);
    setRoles(classifySpeakers(parsed));
  }

  async function handleFile(file: File) {
    const text = await file.text();
    handleText(text);
  }

  const durationMin = useMemo(() => {
    if (segments.length === 0) return 0;
    const start = Math.min(...segments.map((s) => s.start));
    const end = Math.max(...segments.map((s) => s.end));
    return Math.round((end - start) / 60);
  }, [segments]);

  function analyze() {
    const result = computeMetrics(segments, roles, config);
    setMetrics(result);
    onMetrics?.(result, raw, { segments, roles });
  }

  // Cuando el componente se usa dentro del monitoreo, el análisis se envía solo
  // en cuanto el transcript es válido, sin depender del botón "Analizar".
  useEffect(() => {
    if (!onMetrics || segments.length === 0 || roles.length === 0) return;
    const result = computeMetrics(segments, roles, config);
    setMetrics(result);
    onMetrics(result, raw, { segments, roles });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments, roles, config]);

  const students = metrics?.speakers.filter((s) => s.role === "alumno") ?? [];
  const coaches = metrics?.speakers.filter((s) => s.role === "coach") ?? [];

  return (
    <div className="space-y-8">
      {/* Paso 1 */}
      <section className="rounded-xl border bg-card p-5 shadow-panel">
        <h2 className="text-sm font-semibold">1. Pegar transcript</h2>
        <Textarea
          className="mt-3 min-h-40 font-mono text-xs"
          placeholder="Pega aquí el transcript de Zoom (.vtt o texto del panel Audio Transcript)"
          value={raw}
          onChange={(e) => handleText(e.target.value)}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".vtt,.txt,text/plain"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
          />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" />
            Subir archivo .vtt/.txt
          </Button>
          {parseError ? (
            <p className="text-sm text-destructive">{parseError}</p>
          ) : segments.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              {segments.length.toLocaleString("es-SV")} intervenciones · {durationMin} min
            </p>
          ) : null}
        </div>
      </section>

      {/* Paso 2 */}
      {roles.length > 0 ? (
        <section className="rounded-xl border bg-card p-5 shadow-panel">
          <h2 className="text-sm font-semibold">2. Confirmar quién es quién</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Revisa el rol de cada participante antes de analizar.
          </p>
          <ul className="mt-4 space-y-2">
            {[...roles]
              .sort((a, b) => {
                const rank = (r: SpeakerRole) => (r.role === "coach" ? 0 : 1);
                return rank(a) - rank(b) || b.sec - a.sec;
              })
              .map((speaker) => (
                <li
                  key={speaker.key}
                  className={cn(
                    "flex flex-col gap-2 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
                    speaker.role === "coach" ? "border-primary/40 bg-primary/5" : "",
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{speaker.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(speaker.sec / 60).toFixed(1)} min · {speaker.turns} turnos
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {ROLE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setRoles((prev) =>
                            prev.map((r) =>
                              r.key === speaker.key ? { ...r, role: option.value } : r,
                            ),
                          )
                        }
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs transition-colors",
                          speaker.role === option.value
                            ? "border-primary bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
          </ul>
          <Button className="mt-4" onClick={analyze}>
            Analizar
          </Button>
        </section>
      ) : null}

      {/* Paso 3 */}
      {metrics ? (
        <section className="space-y-6">
          <h2 className="text-sm font-semibold">3. Resultados</h2>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Coach %" value={`${metrics.coach_pct} %`} />
            <div className={cn("rounded-xl border p-4 shadow-panel", lightClass(metrics.traffic_light))}>
              <p className="text-xs font-medium uppercase tracking-wide">Alumnos %</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{metrics.students_pct} %</p>
              <p className="text-xs">Meta ≥ {config.talk_time_green} %</p>
            </div>
            <Kpi label="Minutos de alumnos" value={`${(metrics.students_sec / 60).toFixed(1)}`} />
            <Kpi label="Silencio (min)" value={`${metrics.silence_min}`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border bg-card p-5 shadow-panel">
              <p className="mb-2 text-sm font-medium">Distribución del habla</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Coach", value: metrics.coach_pct },
                        { name: "Alumnos", value: metrics.students_pct },
                      ]}
                      dataKey="value"
                      nameKey="name"
                      outerRadius="75%"
                      label={(entry: { value?: number }) => `${entry.value ?? 0} %`}
                      labelLine={false}
                    >
                      <Cell fill={COACH_COLOR} />
                      <Cell fill={STUDENT_COLOR} />
                    </Pie>
                    <Legend verticalAlign="bottom" />
                    <Tooltip formatter={(value: number | string) => `${value} %`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Audio compartido: {metrics.audio_min} min (no incluido)
              </p>
            </div>

            <div className="rounded-xl border bg-card p-5 shadow-panel">
              <p className="mb-2 text-sm font-medium">Por bloque de 10 minutos</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={metrics.blocks_10min.map((b) => ({
                      name: `Bloque ${b.block}`,
                      Coach: b.coach_pct,
                      Alumnos: b.students_pct,
                    }))}
                  >
                    <XAxis type="number" domain={[0, 100]} fontSize={11} />
                    <YAxis type="category" dataKey="name" width={80} fontSize={11} />
                    <Tooltip formatter={(value: number | string) => `${value} %`} />
                    <Legend />
                    <Bar dataKey="Coach" stackId="a" fill={COACH_COLOR} />
                    <Bar dataKey="Alumnos" stackId="a" fill={STUDENT_COLOR} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border bg-card shadow-panel">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Alumno</th>
                    <th className="px-4 py-3 text-right font-medium">Min</th>
                    <th className="px-4 py-3 text-right font-medium">Turnos</th>
                    <th className="px-4 py-3 text-right font-medium">Palabras</th>
                    <th className="px-4 py-3 font-medium">% del tiempo de alumnos</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {students.map((s) => (
                    <tr key={s.key} className="hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2">
                          {s.pct_of_students < config.student_min_pct ? (
                            <AlertTriangle className="size-4 text-amber-500" />
                          ) : null}
                          {s.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{s.min}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{s.turns}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{s.words}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-full max-w-40 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${Math.min(100, s.pct_of_students)}%` }}
                            />
                          </div>
                          <span className="w-12 text-right text-xs tabular-nums">
                            {s.pct_of_students} %
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/40">
                    <td className="px-4 py-3 text-sm font-medium" colSpan={5}>
                      Top 3 alumnos concentran {metrics.top3_students_pct} % del tiempo
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {coaches.length > 1 ? (
            <div className="overflow-hidden rounded-xl border bg-card shadow-panel">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Coach</th>
                    <th className="px-4 py-3 text-right font-medium">Min</th>
                    <th className="px-4 py-3 text-right font-medium">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {coaches.map((c) => (
                    <tr key={c.key}>
                      <td className="px-4 py-3">{c.name}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{c.min}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {metrics.coach_sec > 0
                          ? Math.round((c.sec / metrics.coach_sec) * 1000) / 10
                          : 0}{" "}
                        %
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="rounded-xl border bg-card p-5 shadow-panel">
            <p className="text-sm font-medium">Lectura rápida</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {quickRead(metrics, config).map((line) => (
                <li key={line}>• {line}</li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(metricsToText(metrics));
                  toast.success("Resumen copiado");
                } catch {
                  toast.error("No se pudo copiar");
                }
              }}
            >
              <Copy className="size-4" />
              Copiar resumen
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const blob = new Blob([metricsToCsv(metrics)], {
                  type: "text/csv;charset=utf-8",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "transcript-speakers.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="size-4" />
              Descargar CSV
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-panel">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
