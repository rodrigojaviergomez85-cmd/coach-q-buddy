import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, Copy, Download, ExternalLink, Maximize2, MessageCircle, Target, ThumbsUp, X } from "lucide-react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatDateSV } from "@/lib/date";
import { kudosAoisHtml, normalizeAois, normalizeTextList, reportShareText, secondsToMarker, zoomMarkerUrl, type ClassTimelineData, type ReportData } from "@/lib/monitoring";
import { quickRead, type TranscriptConfig } from "@/lib/transcript";
import { cn } from "@/lib/utils";
import { AreaBar, BlocksChart, ClassTimeline, ItemIcon, PhraseChips, ScoreCircle, StudentBars, TalkTimePie, TrafficLight } from "./ReportVisuals";

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
  const [presenting, setPresenting] = useState(false);
  const { monitoring: m } = report;
  const coachSeesScore = report.config?.coach_sees_score ?? false;
  const showScore = internal || coachSeesScore;
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
  const timeline = m.class_timeline as ClassTimelineData | null | undefined;

  async function copyKudosAois() {
    const { html, text } = kudosAoisHtml(kudos, aois);
    try {
      if (typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        })]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      toast.success("Kudos y AOIs copiados");
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  return <><div className="no-print mx-auto mb-4 flex max-w-[900px] justify-end"><Button variant="outline" onClick={() => setPresenting(true)}><Maximize2 className="size-4" /> Presentar</Button></div><article className="monitoring-report mx-auto max-w-[900px] space-y-6">
    <header className="flex flex-col gap-5 border-b pb-6 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-sm font-semibold text-primary">English4Kids · QA</p><h1 className="mt-1 text-3xl font-bold">{report.coach.name}</h1><p className="mt-2 text-sm text-muted-foreground">{report.template.name} · {formatDateSV(m.class_date)} · {report.coach.lob || "—"} / {m.level || report.coach.level || "—"}</p><p className="text-sm text-muted-foreground">Coordinador: {report.coordinator.name}</p></div>
      <div className="flex items-center gap-4 sm:flex-col sm:gap-1"><ScoreCircle score={m.final_score} showScore={showScore} phrase={m.result_phrase} /><div className="text-center">{showScore ? <p className="font-bold">{m.result_phrase || "Borrador"}</p> : null}<p className="text-sm text-muted-foreground">{m.customer_expectation}</p></div></div>
    </header>

    {penalties.length ? <div className="rounded-md border border-destructive bg-destructive/10 px-4 py-3 font-semibold text-destructive">{showScore ? "Auto 5 aplicado" : "Área crítica"}: {penalties.map((p) => p.item.short_label || p.item.description).join(", ")}</div> : null}
    {bonuses.length ? <div className="flex flex-wrap gap-2">{bonuses.map((b) => <span key={b.item_id} className="rounded-full bg-success/10 px-3 py-1 text-sm font-medium text-success">+ Bonus · {b.item.short_label || b.item.description}</span>)}</div> : null}

    <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded-lg border border-success/30 bg-success/5 p-5"><h2 className="flex items-center gap-2 font-bold text-success"><ThumbsUp className="size-5" /> Lo que hiciste muy bien</h2><ul className="mt-4 space-y-2">{kudos.length ? kudos.map((k, i) => <li key={`${k}-${i}`} className={cn(i === 0 && "text-lg font-bold")}>• {k}</li>) : <li className="text-sm text-muted-foreground">Sin kudos registrados.</li>}</ul></section>
      <section className="rounded-lg border border-warning/40 bg-warning/5 p-5"><h2 className="flex items-center gap-2 font-bold"><Target className="size-5 text-warning" /> En qué enfocarte</h2><div className="mt-4 space-y-3">{aois.length ? aois.map((a, i) => { const linked = a.item_id ? noById.get(a.item_id) : undefined; return <div key={`${a.text}-${i}`} className={cn("rounded-md p-3", i === 0 ? "bg-warning/20 font-semibold" : "bg-background/60")}><p>{a.text}</p>{linked ? <div className="mt-2 text-sm font-normal text-muted-foreground"><p>{linked.item.description}</p>{linked.comment ? <p className="mt-1 italic">“{linked.comment}”</p> : null}</div> : null}</div>; }) : <p className="text-sm text-muted-foreground">Sin AOIs registrados.</p>}</div></section>
    </div>

    {previousAois.length ? <p className="text-sm text-muted-foreground">AOIs del monitoreo anterior: {previousAois.map((aoi) => <span key={aoi} className="mr-2 inline-flex items-center gap-1">{aois.some((a) => a.text.toLowerCase() === aoi.toLowerCase() && a.item_id && report.answers.some((r) => r.item_id === a.item_id && r.result === "si")) ? <CheckCircle2 className="size-4 text-success" /> : null}{aoi}</span>)}</p> : null}

    <section className="space-y-5"><h2 className="text-xl font-bold">Rúbrica</h2>{areaScores(report).map(([area, score]) => <div key={area} className="rounded-lg border bg-card p-5"><AreaBar name={area} earned={score.earned} possible={score.possible} showScore={showScore} /><div className="mt-4 space-y-2">{report.answers.filter((a) => (a.item.area || a.item.section || "General") === area && (a.item.kind === "item" || a.item.kind === "checklist")).sort((a, b) => ({ si: 0, no: 1, na: 2, "": 3 }[a.result] - { si: 0, no: 1, na: 2, "": 3 }[b.result])).map((answer) => { const markerUrl = zoomMarkerUrl(m.zoom_link, answer.evidence_time); return <div key={answer.item_id} className={cn("flex gap-3 rounded-md px-3 py-2", answer.result === "no" && "bg-destructive/10", answer.result === "na" && "text-muted-foreground")}><ItemIcon result={answer.result} /><div className="min-w-0"><p className={cn("text-sm", answer.result === "no" && "font-semibold")}>{answer.item.item_number ? `${answer.item.item_number}. ` : ""}{answer.item.description}</p>{answer.evidence_time != null ? markerUrl ? <a href={markerUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary"><Clock3 className="size-3" />{secondsToMarker(answer.evidence_time)}<ExternalLink className="size-3" /></a> : <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs"><Clock3 className="size-3" />{secondsToMarker(answer.evidence_time)}</span> : null}{answer.result === "no" && answer.comment ? <p className="mt-1 text-sm text-muted-foreground">{answer.comment}</p> : null}</div></div>; })}</div></div>)}</section>

    {timeline ? <section className="space-y-4"><h2 className="text-xl font-bold">Línea de tiempo de la clase</h2><div className="rounded-lg border bg-card p-5"><ClassTimeline timeline={timeline} /></div></section> : null}

    {report.template.has_student_grid ? <section className="space-y-4"><h2 className="text-xl font-bold">Estudiantes</h2><div className="grid grid-cols-3 gap-3">{[["Evaluados", evaluated.length], ["Passing rate", `${passing}%`], ["Calibración", calibration]].map(([label, value]) => <div key={label} className="rounded-lg border bg-card p-4 text-center"><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>)}</div><div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm"><thead className="bg-muted"><tr><th className="p-3 text-left">Alumno</th><th>GR</th><th>PR</th><th>FL</th><th>CO</th><th>IN</th><th>Score</th><th>Frase</th><th>Meta</th></tr></thead><tbody>{evaluated.map((s) => <tr key={s.student_number} className="border-t text-center"><td className="p-3 text-left font-medium">{s.student_name}</td><td>{s.gr}</td><td>{s.pr}</td><td>{s.fl}</td><td>{s.co}</td><td>{s.in}</td><td className="font-bold">{s.score}</td><td>{s.phrase}</td><td>{s.goal ? "✓" : "—"}</td></tr>)}</tbody></table></div></section> : null}

    <section className="space-y-5"><h2 className="text-xl font-bold">¿Quién habló en la clase?</h2>{metrics ? <><div className="grid items-center gap-5 md:grid-cols-2"><TalkTimePie metrics={metrics} /><div className="text-center md:text-left"><div className="inline-flex items-center gap-3"><span className={cn("size-14 rounded-full", metrics.traffic_light === "verde" ? "bg-success" : metrics.traffic_light === "amarillo" ? "bg-warning" : "bg-destructive")} /><div><p className="text-2xl font-bold">Alumnos {metrics.students_pct}%</p><TrafficLight light={metrics.traffic_light} label={`Meta ${transcriptConfig.talk_time_green}%`} /></div></div><p className="mt-4 text-sm text-muted-foreground">Coach: {(metrics.coach_sec / 60).toFixed(1)} min · Alumnos: {(metrics.students_sec / 60).toFixed(1)} min · Silencio: {metrics.silence_min} min</p></div></div><StudentBars metrics={metrics} minimum={transcriptConfig.student_min_pct} /><p className="font-semibold">3 alumnos concentran {metrics.top3_students_pct}% del tiempo</p><div><h3 className="font-bold">Cómo cambió durante la clase</h3><BlocksChart blocks={metrics.blocks_10min} /></div><div className="rounded-lg bg-muted p-4"><h3 className="font-bold">Lectura rápida</h3>{quickRead(metrics, transcriptConfig).map((line) => <p key={line} className="mt-2 text-sm">• {line}</p>)}</div></> : <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">Sin análisis de talking time</div>}</section>

    {report.previous ? <section><h2 className="text-xl font-bold">Comparación anterior</h2><div className="mt-3 grid gap-3 sm:grid-cols-3">{[[showScore ? "Puntaje" : "Resultado", showScore ? `${report.previous.final_score ?? "—"} → ${m.final_score ?? "—"}` : `${report.previous.result_phrase ?? "—"} → ${m.result_phrase ?? "—"}`], ["% alumnos", `${report.previous.students_pct ?? "—"} → ${metrics?.students_pct ?? "—"}`], ["AOIs resueltos", `${previousAois.filter((a) => aois.some((x) => x.text.toLowerCase() === a.toLowerCase())).length} de ${previousAois.length}`]].map(([label, value]) => <div key={label} className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>)}</div>{report.recent_scores.length > 1 ? !showScore ? <div className="mt-4"><PhraseChips items={report.recent_scores.map((r) => ({ date: r.date, phrase: r.phrase ?? null, score: r.score }))} /></div> : <div className="mt-4 h-20"><ResponsiveContainer width="100%" height="100%"><LineChart data={report.recent_scores}><Line type="monotone" dataKey="score" stroke="var(--primary)" strokeWidth={3} dot /></LineChart></ResponsiveContainer></div> : null}</section> : null}

    {m.general_comments ? <section className="rounded-lg border bg-card p-5"><h2 className="font-bold">Comentarios generales</h2><p className="mt-2 whitespace-pre-wrap text-sm">{m.general_comments}</p></section> : null}
    {m.coach_responded_at ? <section className="rounded-lg border border-primary/30 bg-primary/5 p-5"><h2 className="flex items-center gap-2 font-bold"><MessageCircle className="size-5 text-primary" />Respuesta del coach</h2><div className="mt-4 grid gap-4 md:grid-cols-2"><div><p className="text-xs font-semibold uppercase text-muted-foreground">Lo que entendí</p><p className="mt-1 whitespace-pre-wrap text-sm">{m.coach_summary}</p></div><div><p className="text-xs font-semibold uppercase text-muted-foreground">Mi compromiso</p><p className="mt-1 whitespace-pre-wrap text-sm">{m.coach_commitment}</p></div></div>{m.coach_counter ? <p className="mt-4 border-t pt-4 text-sm"><strong>Propuesta:</strong> {m.coach_counter}</p> : null}</section> : internal && m.status === "enviado" ? <section className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">Esperando la respuesta y el compromiso del coach.</section> : null}
    <footer className="flex flex-col gap-4 border-t pt-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><p>Evaluado por {report.coordinator.name} el {formatDateSV(m.qa_date)}</p>{internal ? <div className="no-print flex flex-wrap gap-2"><Button variant="outline" onClick={() => window.print()}><Download className="size-4" /> Descargar PDF</Button>{m.status === "enviado" ? <Button variant="outline" onClick={() => void copyKudosAois()}><Copy className="size-4" /> Copiar Kudos y AOIs</Button> : null}{shareUrl ? <><Button variant="outline" onClick={() => void navigator.clipboard.writeText(shareUrl).then(() => toast.success("Link copiado"))}><Copy className="size-4" /> Copiar link</Button><Button variant="outline" onClick={() => void navigator.clipboard.writeText(reportShareText(report, shareUrl, coachSeesScore)).then(() => toast.success("Resumen copiado"))}><Copy className="size-4" /> Copiar resumen</Button>{report.coach.phone ? <Button variant="outline" onClick={() => window.open(`https://wa.me/${report.coach.phone!.replace(/\D/g, "")}?text=${encodeURIComponent(reportShareText(report, shareUrl, coachSeesScore))}`, "_blank", "noopener")}><MessageCircle className="size-4" /> Enviar por WhatsApp</Button> : null}</> : null}</div> : null}</footer>
  </article>{presenting ? <PresentationMode report={report} showScore={coachSeesScore} onClose={() => setPresenting(false)} /> : null}</>;
}

function PresentationMode({ report, showScore, onClose }: { report: ReportData; showScore: boolean; onClose: () => void }) {
  const [slide, setSlide] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const { monitoring: m } = report;
  const metrics = m.transcript_metrics;
  const timeline = m.class_timeline as ClassTimelineData | null | undefined;
  const kudos = normalizeTextList(m.kudos);
  const aois = normalizeAois(m.aois);
  const previousAois = normalizeTextList(m.previous_aois);
  const penalties = report.answers.filter((a) => a.item.kind === "penalty" && a.result === "si");
  const bonuses = report.answers.filter((a) => a.item.kind === "bonus" && a.result === "si");
  const transcriptConfig = report.config ?? DEFAULT_TRANSCRIPT_CONFIG;
  const close = () => { if (document.fullscreenElement) void document.exitFullscreen(); onClose(); };
  useEffect(() => {
    if (root.current?.requestFullscreen) void root.current.requestFullscreen().catch(() => undefined);
    const keys = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") setSlide((value) => Math.min(3, value + 1));
      if (event.key === "ArrowLeft") setSlide((value) => Math.max(0, value - 1));
      if (event.key === "Escape") close();
    };
    const fullscreen = () => { if (!document.fullscreenElement) onClose(); };
    window.addEventListener("keydown", keys); document.addEventListener("fullscreenchange", fullscreen);
    return () => { window.removeEventListener("keydown", keys); document.removeEventListener("fullscreenchange", fullscreen); };
  }, []);
  return <div ref={root} role="dialog" aria-label="Presentación del reporte" className="fixed inset-0 z-[100] flex min-h-screen flex-col bg-background text-[1.22rem] leading-relaxed text-foreground">
    <header className="flex items-center justify-between border-b px-8 py-4"><div><p className="font-semibold text-primary">English4Kids · QA</p><h1 className="text-3xl font-bold">{report.coach.name}</h1></div><div className="flex items-center gap-5"><strong className="text-2xl tabular-nums">{slide + 1} / 4</strong><Button size="icon" variant="ghost" onClick={close} aria-label="Salir de presentación"><X className="size-7" /></Button></div></header>
    <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6 lg:px-14">{slide === 0 ? <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[18rem_1fr]"><div className="flex flex-col items-center justify-center rounded-lg border bg-card p-8"><ScoreCircle score={m.final_score} showScore={showScore} phrase={m.result_phrase} />{showScore ? <p className="mt-5 text-center text-2xl font-bold">{m.result_phrase}</p> : null}<p className="text-center text-muted-foreground">{m.customer_expectation}</p></div><div className="grid gap-6"><section className="rounded-lg border border-success/30 bg-success/5 p-7"><h2 className="flex items-center gap-3 text-2xl font-bold text-success"><ThumbsUp className="size-7" /> Lo que hiciste muy bien</h2><ul className="mt-5 space-y-3">{kudos.map((item) => <li key={item}>• {item}</li>)}</ul></section><section className="rounded-lg border border-warning/40 bg-warning/5 p-7"><h2 className="flex items-center gap-3 text-2xl font-bold"><Target className="size-7 text-warning" /> En qué enfocarte</h2><ul className="mt-5 space-y-3">{aois.map((item) => <li key={item.text}>• {item.text}</li>)}</ul></section></div></div> : null}
      {slide === 1 ? <div className="mx-auto max-w-6xl"><h2 className="mb-6 text-3xl font-bold">Rúbrica visual</h2>{penalties.length ? <div className="mb-5 rounded-lg border border-destructive bg-destructive/10 p-4 font-bold text-destructive">{showScore ? "Auto 5" : "Área crítica"}: {penalties.map((item) => item.item.short_label || item.item.description).join(", ")}</div> : null}{bonuses.length ? <div className="mb-5 text-success">Bonus: {bonuses.map((item) => item.item.short_label || item.item.description).join(", ")}</div> : null}<div className="space-y-5">{areaScores(report).map(([area, score]) => <section key={area} className="rounded-lg border bg-card p-6"><AreaBar name={area} earned={score.earned} possible={score.possible} showScore={showScore} /><div className="mt-4 grid gap-2 lg:grid-cols-2">{report.answers.filter((a) => (a.item.area || a.item.section || "General") === area && ["item", "checklist"].includes(a.item.kind ?? "")).map((answer) => <div key={answer.item_id} className={cn("flex gap-3 rounded-md p-3", answer.result === "no" && "bg-destructive/10")}><ItemIcon result={answer.result} /><span>{answer.item.description}</span></div>)}</div></section>)}</div></div> : null}
      {slide === 2 ? <div className="mx-auto max-w-6xl"><h2 className="mb-6 text-3xl font-bold">Cómo se repartió la clase</h2>{timeline ? <div className="mb-8 rounded-lg border bg-card p-6"><ClassTimeline timeline={timeline} /></div> : null}{metrics ? <div className="grid gap-8 lg:grid-cols-2"><TalkTimePie metrics={metrics} /><div><p className="text-4xl font-bold">Alumnos {metrics.students_pct}%</p><TrafficLight light={metrics.traffic_light} label={`Meta ${transcriptConfig.talk_time_green}%`} /><p className="mt-5 text-muted-foreground">Coach: {(metrics.coach_sec / 60).toFixed(1)} min · Alumnos: {(metrics.students_sec / 60).toFixed(1)} min · Silencio: {metrics.silence_min} min</p><div className="mt-7"><StudentBars metrics={metrics} minimum={transcriptConfig.student_min_pct} /></div></div><div className="lg:col-span-2"><BlocksChart blocks={metrics.blocks_10min} /></div></div> : <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">Sin análisis de talking time</div>}</div> : null}
      {slide === 3 ? <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2"><section><h2 className="mb-5 text-3xl font-bold">Comparación anterior</h2>{report.previous ? <div className="grid gap-4">{[[showScore ? "Puntaje" : "Resultado", showScore ? `${report.previous.final_score ?? "—"} → ${m.final_score ?? "—"}` : `${report.previous.result_phrase ?? "—"} → ${m.result_phrase ?? "—"}`], ["% alumnos", `${report.previous.students_pct ?? "—"} → ${metrics?.students_pct ?? "—"}`], ["AOIs anteriores", previousAois.join(", ") || "—"]].map(([label, value]) => <div key={label} className="rounded-lg border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>)}{!showScore && report.recent_scores.length > 1 ? <div className="rounded-lg border bg-card p-5"><p className="mb-2 text-sm text-muted-foreground">Últimos monitoreos</p><PhraseChips items={report.recent_scores.map((r) => ({ date: r.date, phrase: r.phrase ?? null, score: r.score }))} /></div> : null}</div> : <p className="text-muted-foreground">No hay un monitoreo anterior.</p>}</section><section><h2 className="mb-5 text-3xl font-bold">Respuesta del coach</h2>{m.coach_responded_at ? <div className="space-y-5 rounded-lg border border-primary/30 bg-primary/5 p-6"><div><p className="text-sm font-bold uppercase text-muted-foreground">Lo que entendí</p><p className="mt-2 whitespace-pre-wrap">{m.coach_summary}</p></div><div><p className="text-sm font-bold uppercase text-muted-foreground">Mi compromiso</p><p className="mt-2 whitespace-pre-wrap">{m.coach_commitment}</p></div>{m.coach_counter ? <p className="border-t pt-4"><strong>Propuesta:</strong> {m.coach_counter}</p> : null}</div> : <div className="rounded-lg border border-dashed p-8 text-muted-foreground">Respuesta pendiente.</div>}</section></div> : null}</div>
    <footer className="flex items-center justify-end gap-4 border-t px-8 py-4"><Button size="lg" variant="outline" disabled={slide === 0} onClick={() => setSlide((value) => Math.max(0, value - 1))}><ArrowLeft className="size-5" /> Anterior</Button><Button size="lg" disabled={slide === 3} onClick={() => setSlide((value) => Math.min(3, value + 1))}>Siguiente <ArrowRight className="size-5" /></Button></footer>
  </div>;
}