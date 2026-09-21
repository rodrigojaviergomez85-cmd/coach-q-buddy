import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MonitoringReport } from "@/components/monitoring/MonitoringReport";
import { getPublicReport } from "@/lib/report.functions";

export const Route = createFileRoute("/r/$token")({
  head: () => ({ meta: [{ title: "Reporte QA · English4Kids" }, { name: "description", content: "Reporte de retroalimentación de clase." }, { property: "og:title", content: "Reporte QA · English4Kids" }, { property: "og:description", content: "Reporte de retroalimentación de clase." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: PublicReportPage,
});

function PublicReportPage() {
  const { token } = Route.useParams();
  const query = useQuery({ queryKey: ["public-report", token], retry: false, queryFn: () => getPublicReport({ data: { token } }) });
  if (query.isLoading) return <main className="grid min-h-screen place-items-center bg-background"><p className="text-sm text-muted-foreground">Cargando reporte…</p></main>;
  if (query.isError || !query.data) return <main className="grid min-h-screen place-items-center bg-background px-4"><div className="max-w-md rounded-xl border bg-card p-10 text-center"><h1 className="text-xl font-bold">Este reporte no está disponible</h1><p className="mt-2 text-sm text-muted-foreground">Revisa el enlace o solicita uno nuevo a tu coordinador.</p></div></main>;
  return <main className="min-h-screen bg-background px-4 py-8 sm:px-8"><MonitoringReport report={query.data} /></main>;
}