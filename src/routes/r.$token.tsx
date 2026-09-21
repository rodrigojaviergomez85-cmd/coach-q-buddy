import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MonitoringReport } from "@/components/monitoring/MonitoringReport";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getPublicReport, submitCoachResponse } from "@/lib/report.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/r/$token")({
  head: () => ({ meta: [{ title: "Reporte QA · English4Kids" }, { name: "description", content: "Reporte de retroalimentación de clase." }, { property: "og:title", content: "Reporte QA · English4Kids" }, { property: "og:description", content: "Reporte de retroalimentación de clase." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: PublicReportPage,
});

function PublicReportPage() {
  const { token } = Route.useParams();
  const queryClient = useQueryClient();
  const [response, setResponse] = useState({ summary: "", commitment: "", counter: "" });
  const query = useQuery({ queryKey: ["public-report", token], retry: false, queryFn: () => getPublicReport({ data: { token } }) });
  const submit = useMutation({ mutationFn: () => submitCoachResponse({ data: { token, ...response } }), onSuccess: () => { toast.success("Tu respuesta fue enviada"); void queryClient.invalidateQueries({ queryKey: ["public-report", token] }); }, onError: (error: Error) => toast.error(error.message) });
  if (query.isLoading) return <main className="grid min-h-screen place-items-center bg-background"><p className="text-sm text-muted-foreground">Cargando reporte…</p></main>;
  if (query.isError || !query.data) return <main className="grid min-h-screen place-items-center bg-background px-4"><div className="max-w-md rounded-xl border bg-card p-10 text-center"><h1 className="text-xl font-bold">Este reporte no está disponible</h1><p className="mt-2 text-sm text-muted-foreground">Revisa el enlace o solicita uno nuevo a tu coordinador.</p></div></main>;
  return <main className="min-h-screen bg-background px-4 py-8 sm:px-8"><MonitoringReport report={query.data} />{!query.data.monitoring.coach_responded_at ? <section className="mx-auto mt-8 max-w-[900px] border-t pt-8"><div className="rounded-lg border bg-card p-5"><h2 className="text-xl font-bold">Tu turno</h2><p className="mt-1 text-sm text-muted-foreground">Confirma lo que entendiste y el compromiso que pondrás en práctica.</p><div className="mt-5 grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Lo que entendí</Label><Textarea maxLength={2000} value={response.summary} onChange={(e) => setResponse((v) => ({ ...v, summary: e.target.value }))} /></div><div className="space-y-2"><Label>Mi compromiso</Label><Textarea maxLength={2000} value={response.commitment} onChange={(e) => setResponse((v) => ({ ...v, commitment: e.target.value }))} /></div></div><div className="mt-4 space-y-2"><Label>Mi propuesta o comentario (opcional)</Label><Textarea maxLength={2000} value={response.counter} onChange={(e) => setResponse((v) => ({ ...v, counter: e.target.value }))} /></div><Button className="mt-5" disabled={!response.summary.trim() || !response.commitment.trim() || submit.isPending} onClick={() => submit.mutate()}>Enviar respuesta</Button></div></section> : null}</main>;
}