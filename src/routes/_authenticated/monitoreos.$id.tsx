import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Pencil } from "lucide-react";
import { MonitoringReport } from "@/components/monitoring/MonitoringReport";
import { Button } from "@/components/ui/button";
import { fetchInternalReport } from "@/lib/monitoring-data";

export const Route = createFileRoute("/_authenticated/monitoreos/$id")({
  head: () => ({ meta: [{ title: "Reporte de monitoreo · QA Coaches E4K" }, { name: "description", content: "Reporte interno de calidad de una clase." }, { property: "og:title", content: "Reporte de monitoreo · QA Coaches E4K" }, { property: "og:description", content: "Retroalimentación de calidad de una clase." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: ReportPage,
});

function ReportPage() {
  const { id } = Route.useParams();
  const query = useQuery({ queryKey: ["monitoring-report", id], queryFn: () => fetchInternalReport(id) });
  if (query.isLoading) return <p className="text-sm text-muted-foreground">Cargando reporte…</p>;
  if (query.isError || !query.data) return <div className="rounded-lg border border-dashed p-12 text-center"><p className="font-semibold">No pudimos abrir este monitoreo.</p><Link to="/monitoreos" className="mt-2 inline-block text-sm text-primary">Volver a monitoreos</Link></div>;
  const shareUrl = query.data.monitoring.status === "enviado" ? `${window.location.origin}/r/${(query.data.monitoring as typeof query.data.monitoring & { share_token?: string }).share_token ?? ""}` : undefined;
  return <><div className="no-print mb-6 flex items-center justify-between"><Button asChild variant="ghost"><Link to="/monitoreos"><ArrowLeft className="size-4" /> Monitoreos</Link></Button><Button asChild variant="outline"><Link to="/monitoreos/$id/editar" params={{ id }}><Pencil className="size-4" /> Editar</Link></Button></div><MonitoringReport report={query.data} internal shareUrl={shareUrl} /></>;
}