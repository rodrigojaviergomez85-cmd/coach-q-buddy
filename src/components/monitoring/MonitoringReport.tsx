import { CheckCircle2, Copy, Download, Target, ThumbsUp } from "lucide-react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatDateSV } from "@/lib/date";
import { normalizeAois, normalizeTextList, reportShareText, type ReportData } from "@/lib/monitoring";
import { quickRead, type TranscriptConfig } from "@/lib/transcript";
import { cn } from "@/lib/utils";
import { AreaBar, BlocksChart, ItemIcon, ScoreCircle, StudentBars, TalkTimePie, TrafficLight } from "./ReportVisuals";

const DEFAULT_TRANSCRIPT_CONFIG: TranscriptConfig = { talk_time_green: 70, talk_time_yellow: 55, student_min_pct: 8 };

function areaScores(report: ReportData) {
  const map = new Map<string, { earned: number; possible: number }>();
  for (const answer of report.answers.filter((a) => a.item.kind === "item" || a.item.kind === "checklist")) {
    const area = answer.item.area || answer.item.section || "General";
    const current = map.get(area) ?? { earned: 0, possible: 0 };
    if (answer.result !== "na") {
      const points = Number(answer.item.points ?? (answer.item.kind === "checklist" ? 1 : 0));
      current.possible += points;
      if (answer.result === "si") current.earned += points;
    }
    map.set(area, current);
  }
  return Array.from(map.entries());
}

export function MonitoringReport({ report, internal = false, shareUrl }: { report: ReportData; internal?: boolean; shareUrl?: string | undefined }) {
  const { monitoring: m } = report;
  const transcriptConfig = report.config ?? DEFAULT_TRANSCRIPT_CONFIG;
  const kudos = normalizeTextList(m.kudos);
  const aois = normalizeAois(m.aois);
  const previousAois = normalizeTextList(m.previous_aois);
  const noById = new Map(report.answers.filter((a) => a.result === "no").map((a) => [a.item_id, a]));
  const penalties = report.answers.filter((a) => a.item.kind === "penalty" && a.result === "si");
  const bonuses = report.answers.filter((a) => a.item.kind === "bonus" && a.result === "si");
  const metrics = m.transcript_metrics;
  const evaluated = report.students.filter((s) => s.student_name);
  const passing = evaluated.length ? Math.round((evaluated.filter((s) => s.goal).length / evaluated.length) * 100) : 0;
  const calibration = evaluated.filter((s) => s.phrase && s.coach_phrase && s.phrase !== s.coach_phrase).length;

  return <article className="monitoring-report mx-auto max-w-[900px] space-y-6">
    <header className="flex flex-col gap-5 border-b pb-6 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-sm font-semibold text-primary">English4Kids · QA</p><h1 className="mt-1 text-3xl font-bold">{report.coach.name}</h1><p className="mt-2 text-sm text-muted-foreground">{report.template.name} · {formatDateSV(m.class_date)} · {report.coach.lob || "—"} / {m.level || report.coach.level || "—"}</p><p className="text-sm text-muted-foreground">Coordinador: {report.coordinator.name}</p></div>
      <div className="flex items-center gap-4 sm:flex-col sm:gap-1"><ScoreCircle score={m.final_score} /><div className="text-center"><p className="font-bold">{m.result_phrase || "Borrador"}</p><p className="text-sm text-muted-foreground">{m.customer_expectation}</p></div></div>
    </header>

    {penalties.length ? <div className="rounded-md border border-destructive bg-destructive/10 px-4 py-3 font-semibold text-destructive">Auto 5 aplicado: {penalties.map((p) => p.item.short_label || p.item.description).join(", ")}</div> : null}
    {bonuses.length ? <div className="flex flex-wrap gap-2">{bonuses.map((b) => <span key={b.item_id} className="rounded-full bg-success/10 px-3 py-1 text-sm font-medium text-success">+ Bonus · {b.item.short_label || b.item.description}</span>)}</div> : null}

    <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded-lg border border-success/30 bg-success/5 p-5"><h2 className="flex items-center gap-2 font-bold text-success"><ThumbsUp className="size-5" /> Lo que hiciste muy bien</h2><ul className="mt-4 space-y-2">{kudos.length ? kudos.map((k, i) => <li key={`${k}-${i}`} className={cn(i === 0 && "text-lg font-bold")}>• {k}</li>) : <li className="text-sm text-muted-foreground">Sin kudos registrados.</li>}</ul></section>
      <section className="rounded-lg border border-warning/40 bg-warning/5 p-5"><h2 className="flex items-center gap-2 font-bold"><Target className="size-5 text-warning" /> En qué enfocarte</h2><div className="mt-4 space-y-3">{aois.length ? aois.map((a, i) => { const linked = a.item_id ? noById.get(a.item_id) : undefined; return <div key={`${a.text}-${i}`} className={cn("rounded-md p-3", i === 0 ? "bg-warning/20 font-semibold" : "bg-background/60")}><p>{a.text}</p>{linked ? <div className="mt-2 text-sm font-normal text-muted-foreground"><p>{linked.item.description}</p>{linked.comment ? <p className="mt-1 italic">“{linked.comment}”</p> : null}</div> : null}</div>; }) : <p className="text-sm text-muted-foreground">Sin AOIs registrados.</p>}</div></section>
    </div>

    {previousAois.length ? <p className="text-sm text-muted-foreground">AOIs del monitoreo anterior: {previousAois.map((aoi) => <span key={aoi} className="mr-2 inline-flex items-center gap-1">{aois.some((a) => a.text.toLowerCase() === aoi.toLowerCase() && a.item_id && report.answers.some((r) => r.item_id === a.item_id && r.result === "si")) ? <CheckCircle2 className="size-4 text-success" /> : null}{aoi}</span>)}</p> : null}

    <section className="space-y-5"><h2 className="text-xl font-bold">Rúbrica</h2>{areaScores(report).map(([area, score]) => <div key={area} className="rounded-lg border bg-card p-5"><AreaBar name={area} earned={score.earned} possible={score.possible} /><div className="mt-4 space-y-2">{report.answers.filter((a) => (a.item.area || a.item.section || "General") === area && (a.item.kind === "item" || a.item.kind === "checklist")).sort((a, b) => ({ si: 0, no: 1, na: 2, "": 3 }[a.result] - { si: 0, no: 1, na: 2, "": 3 }[b.result])).map((answer) => <div key={answer.item_id} className={cn("flex gap-3 rounded-md px-3 py-2", answer.result === "no" && "bg-destructive/10", answer.result === "na" && "text-muted-foreground")}><ItemIcon result={answer.result} /><div><p className={cn("text-sm", answer.result === "no" && "font-semibold")}>{answer.item.item_number ? `${answer.item.item_number}. ` : ""}{answer.item.description}</p>{answer.result === "no" && answer.comment ? <p className="mt-1 text-sm text-muted-foreground">{answer.comment}</p> : null}</div></div>)}</div></div>)}</section>

    {report.template.has_student_grid ? <section className="space-y-4"><h2 className="text-xl font-bold">Estudiantes</h2><div className="grid grid-cols-3 gap-3">{[["Evaluados", evaluated.length], ["Passing rate", `${passing}%`], ["Calibración", calibration]].map(([label, value]) => <div key={label} className="rounded-lg border bg-card p-4 text-center"><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>)}</div><div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm"><thead className="bg-muted"><tr><th className="p-3 text-left">Alumno</th><th>GR</th><th>PR</th><th>FL</th><th>CO</th><th>IN</th><th>Score</th><th>Frase</th><th>Meta</th></tr></thead><tbody>{evaluated.map((s) => <tr key={s.student_number} className="border-t text-center"><td className="p-3 text-left font-medium">{s.student_name}</td><td>{s.gr}</td><td>{s.pr}</td><td>{s.fl}</td><td>{s.co}</td><td>{s.in}</td><td className="font-bold">{s.score}</td><td>{s.phrase}</td><td>{s.goal ? "✓" : "—"}</td></tr>)}</tbody></table></div></section> : null}

    <section className="space-y-5"><h2 className="text-xl font-bold">¿Quién habló en la clase?</h2>{metrics ? <><div className="grid items-center gap-5 md:grid-cols-2"><TalkTimePie metrics={metrics} /><div className="text-center md:text-left"><div className="inline-flex items-center gap-3"><span className={cn("size-14 rounded-full", metrics.traffic_light === "verde" ? "bg-success" : metrics.traffic_light === "amarillo" ? "bg-warning" : "bg-destructive")} /><div><p className="text-2xl font-bold">Alumnos {metrics.students_pct}%</p><TrafficLight light={metrics.traffic_light} label={`Meta ${transcriptConfig.talk_time_green}%`} /></div></div><p className="mt-4 text-sm text-muted-foreground">Coach: {(metrics.coach_sec / 60).toFixed(1)} min · Alumnos: {(metrics.students_sec / 60).toFixed(1)} min · Silencio: {metrics.silence_min} min</p></div></div><StudentBars metrics={metrics} minimum={transcriptConfig.student_min_pct} /><p className="font-semibold">3 alumnos concentran {metrics.top3_students_pct}% del tiempo</p><div><h3 className="font-bold">Cómo cambió durante la clase</h3><BlocksChart blocks={metrics.blocks_10min} /></div><div className="rounded-lg bg-muted p-4"><h3 className="font-bold">Lectura rápida</h3>{quickRead(metrics, transcriptConfig).map((line) => <p key={line} className="mt-2 text-sm">• {line}</p>)}</div></> : <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">Sin análisis de talking time</div>}</section>

    {report.previous ? <section><h2 className="text-xl font-bold">Comparación anterior</h2><div className="mt-3 grid gap-3 sm:grid-cols-3">{[["Puntaje", `${report.previous.final_score ?? "—"} → ${m.final_score ?? "—"}`], ["% alumnos", `${report.previous.students_pct ?? "—"} → ${metrics?.students_pct ?? "—"}`], ["AOIs resueltos", `${previousAois.filter((a) => aois.some((x) => x.text.toLowerCase() === a.toLowerCase())).length} de ${previousAois.length}`]].map(([label, value]) => <div key={label} className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>)}</div>{report.recent_scores.length > 1 ? <div className="mt-4 h-20"><ResponsiveContainer width="100%" height="100%"><LineChart data={report.recent_scores}><Line type="monotone" dataKey="score" stroke="var(--primary)" strokeWidth={3} dot /></LineChart></ResponsiveContainer></div> : null}</section> : null}

    {m.general_comments ? <section className="rounded-lg border bg-card p-5"><h2 className="font-bold">Comentarios generales</h2><p className="mt-2 whitespace-pre-wrap text-sm">{m.general_comments}</p></section> : null}
    <footer className="flex flex-col gap-4 border-t pt-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><p>Evaluado por {report.coordinator.name} el {formatDateSV(m.qa_date)}</p>{internal ? <div className="no-print flex flex-wrap gap-2"><Button variant="outline" onClick={() => window.print()}><Download className="size-4" /> Descargar PDF</Button>{shareUrl ? <><Button variant="outline" onClick={() => void navigator.clipboard.writeText(shareUrl).then(() => toast.success("Link copiado"))}><Copy className="size-4" /> Copiar link</Button><Button variant="outline" onClick={() => void navigator.clipboard.writeText(reportShareText(report, shareUrl)).then(() => toast.success("Resumen copiado"))}><Copy className="size-4" /> Copiar resumen</Button></> : null}</div> : null}</footer>
  </article>;
}