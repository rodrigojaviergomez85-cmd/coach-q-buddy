import { AlertTriangle, Check, Minus, X } from "lucide-react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { QA_COLORS } from "@/lib/colors";
import { cn } from "@/lib/utils";
import type { BlockMetric, Metrics } from "@/lib/transcript";
import type { ClassTimelineData } from "@/lib/monitoring";

export function scoreTone(score: number | null | undefined) {
  if ((score ?? 0) >= 9) return "success";
  if ((score ?? 0) >= 8) return "primary";
  if ((score ?? 0) >= 7) return "warning";
  return "destructive";
}

const toneClasses = { success: "border-success bg-success/10 text-success", primary: "border-primary bg-primary/10 text-primary", warning: "border-warning bg-warning/15 text-warning-foreground", destructive: "border-destructive bg-destructive/10 text-destructive" };

export function ScoreCircle({ score, size = "lg" }: { score: number | null; size?: "sm" | "lg" }) {
  const tone = scoreTone(score);
  return <div className={cn("grid shrink-0 place-items-center rounded-full border-4 font-bold tabular-nums", toneClasses[tone], size === "lg" ? "size-28 text-4xl" : "size-14 text-lg")}>{score == null ? "—" : score.toFixed(1)}</div>;
}

export function TrafficLight({ light, label }: { light: Metrics["traffic_light"]; label?: string }) {
  const classes = light === "verde" ? "bg-success" : light === "amarillo" ? "bg-warning" : "bg-destructive";
  return <span className="inline-flex items-center gap-2 text-sm font-medium"><span className={cn("size-3 rounded-full", classes)} />{label ?? light}</span>;
}

export function AreaBar({ name, earned, possible }: { name: string; earned: number; possible: number }) {
  const pct = possible > 0 ? Math.min(100, (earned / possible) * 100) : 0;
  return <div><div className="mb-1 flex justify-between gap-3 text-sm font-semibold"><span>{name}</span><span className="tabular-nums">{earned.toFixed(1)} / {possible.toFixed(1)}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} /></div></div>;
}

export function ItemIcon({ result }: { result: string }) {
  if (result === "si") return <Check className="size-5 text-success" />;
  if (result === "no") return <X className="size-5 text-destructive" />;
  return <Minus className="size-5 text-muted-foreground" />;
}

export function TalkTimePie({ metrics }: { metrics: Metrics }) {
  const data = [{ name: "Coach", value: metrics.coach_pct }, { name: "Alumnos", value: metrics.students_pct }];
  return <div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius="30%" outerRadius="82%" labelLine={false} label={({ value }) => `${value}%`}><Cell fill={QA_COLORS.coach} /><Cell fill={QA_COLORS.students} /></Pie><Tooltip formatter={(value) => `${value} %`} /></PieChart></ResponsiveContainer></div>;
}

export function StudentBars({ metrics, minimum }: { metrics: Metrics; minimum: number }) {
  const students = metrics.speakers.filter((s) => s.role === "alumno");
  return <div className="space-y-3">{students.map((student) => { const low = student.pct_of_students < minimum; return <div key={student.key} className="grid grid-cols-[minmax(7rem,1fr)_2fr_auto] items-center gap-3 text-sm"><span className="truncate font-medium">{student.name}</span><div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", low ? "bg-destructive" : "bg-success")} style={{ width: `${Math.min(100, student.pct_of_students)}%` }} /></div><span className="flex items-center gap-1 tabular-nums">{student.min} min {low ? <AlertTriangle className="size-3 text-destructive" /> : null}</span></div>; })}</div>;
}

export function BlocksChart({ blocks }: { blocks: BlockMetric[] }) {
  const data = blocks.map((b) => ({ name: `${(b.block - 1) * 10}–${b.block * 10}`, Coach: b.coach_pct, Alumnos: b.students_pct }));
  return <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart layout="vertical" data={data} margin={{ left: 0, right: 10 }}><XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} fontSize={11} /><YAxis type="category" dataKey="name" width={54} fontSize={11} /><Tooltip formatter={(value) => `${value} %`} /><Bar dataKey="Coach" stackId="a" fill={QA_COLORS.coach} /><Bar dataKey="Alumnos" stackId="a" fill={QA_COLORS.students} /></BarChart></ResponsiveContainer></div>;
}

const phaseNames = { inicio: "Inicio", contenido: "Contenido", break: "Break", af: "AF", cierre: "Cierre" };
const phaseClasses = { inicio: "bg-primary", contenido: "bg-success", break: "bg-warning", af: "bg-secondary", cierre: "bg-destructive" };

export function ClassTimeline({ timeline }: { timeline: ClassTimelineData }) {
  if (!timeline.phases.length || timeline.duration <= 0) return null;
  return <section className="space-y-3"><div className="flex h-12 overflow-hidden rounded-md border bg-muted">{timeline.phases.map((phase) => <div key={`${phase.kind}-${phase.start}`} className={cn("grid min-w-12 place-items-center px-2 text-xs font-semibold text-primary-foreground", phaseClasses[phase.kind])} style={{ width: `${((phase.end - phase.start) / timeline.duration) * 100}%` }} title={`${phaseNames[phase.kind]} · ${Math.round(phase.start / 60)}–${Math.round(phase.end / 60)} min`}>{phaseNames[phase.kind]}</div>)}</div><div className="flex justify-between text-xs text-muted-foreground"><span>0 min</span><span>{Math.round(timeline.duration / 60)} min</span></div>{timeline.af_students.length ? <p className="text-sm"><strong>Alumnos que hablaron en AF:</strong> {timeline.af_students.join(", ")}</p> : null}</section>;
}