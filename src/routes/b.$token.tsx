import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { ScoreCircle, StudentBars, TalkTimePie, TrafficLight } from "@/components/monitoring/ReportVisuals";
import { getPublicBetty } from "@/lib/betty.functions";
import { formatDateSV } from "@/lib/date";
import type { Metrics } from "@/lib/transcript";

export const Route = createFileRoute("/b/$token")({
  component: PublicBetty,
  head: () => ({
    meta: [
      { title: "Análisis de práctica · Coach Betty Well" },
      { name: "description", content: "Análisis de práctica de tu clase, hecho por Coach Betty Well." },
      { property: "og:title", content: "Análisis de práctica · Coach Betty Well" },
      { property: "og:description", content: "Análisis de práctica de tu clase, hecho por Coach Betty Well." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

interface PublicPayload {
  coach: { name: string; lob: string | null; level: string | null };
  scan: {
    class_date: string | null; level: string | null; lob: string | null;
    betty_score: number | null; betty_phrase: string | null; summary: string | null;
    kudos: string[] | null; aois: string[] | null; transcript_metrics: Metrics | null;
  };
  config: { coach_sees_score: boolean; talk_time_green: number; talk_time_yellow: number; student_min_pct: number };
}

function PublicBetty() {
  const { token } = Route.useParams();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-betty", token],
    queryFn: async () => (await getPublicBetty({ data: { token } })) as PublicPayload | null,
  });

  if (isLoading) return <main className="mx-auto max-w-3xl p-6 text-muted-foreground">Cargando…</main>;
  if (isError || !data) return <main className="mx-auto max-w-3xl p-6">Este enlace ya no está disponible.</main>;

  const showScore = Boolean(data.config?.coach_sees_score);
  const metrics = data.scan.transcript_metrics;

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
      <div className="rounded-xl border border-warning bg-warning/15 px-4 py-3 text-sm font-semibold">
        Análisis de práctica de Coach Betty Well · no es un monitoreo oficial
      </div>

      <section className="flex flex-wrap items-center gap-5 rounded-xl border bg-card p-5">
        <ScoreCircle score={data.scan.betty_score} showScore={showScore} phrase={data.scan.betty_phrase} />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold">{data.coach.name}</h1>
          <p className="text-sm text-muted-foreground">
            {data.scan.class_date ? formatDateSV(data.scan.class_date) : "—"} · {data.scan.level ?? "—"}
          </p>
          {data.scan.summary ? <p className="pt-2 text-sm">{data.scan.summary}</p> : null}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <h2 className="mb-2 font-semibold text-success">Kudos</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {(data.scan.kudos ?? []).map((k, i) => <li key={i}>{k}</li>)}
          </ul>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <h2 className="mb-2 font-semibold text-warning-foreground">Áreas de mejora</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {(data.scan.aois ?? []).map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      </section>

      {metrics ? (
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <h2 className="font-semibold">¿Quién habló en la clase?</h2>
          <TalkTimePie metrics={metrics} />
          <TrafficLight light={metrics.traffic_light} label={`Alumnos ${metrics.students_pct} %`} />
          <StudentBars metrics={metrics} minimum={data.config?.student_min_pct ?? 8} />
        </section>
      ) : null}
    </main>
  );
}
