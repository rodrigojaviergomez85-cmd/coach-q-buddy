import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, SearchCheck } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatDateSV } from "@/lib/date";

export const Route = createFileRoute("/_authenticated/betty/")({
  component: BettyList,
  head: () => ({
    meta: [
      { title: "Coach Betty Well · QA Coaches E4K" },
      { name: "description", content: "Análisis auxiliares de clases con Coach Betty Well." },
      { property: "og:title", content: "Coach Betty Well · QA Coaches E4K" },
      { property: "og:description", content: "Análisis auxiliares de clases con Coach Betty Well." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function light(pct: number | null | undefined): string {
  if (pct == null) return "bg-muted text-muted-foreground";
  if (pct >= 70) return "bg-emerald-500/15 text-emerald-700";
  if (pct >= 55) return "bg-amber-500/15 text-amber-700";
  return "bg-red-500/15 text-red-700";
}

function BettyList() {
  const { data, isLoading } = useQuery({
    queryKey: ["betty-scans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("betty_scans")
        .select("id, class_date, level, betty_score, betty_phrase, status, transcript_metrics, coach:coaches(full_name)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coach Betty Well"
        subtitle="Analista auxiliar · sus resultados no son oficiales"
        actions={
          <Button asChild>
            <Link to="/betty/nuevo"><Plus className="mr-2 size-4" />Nuevo análisis</Link>
          </Button>
        }
      />

      <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
        <div className="flex size-11 items-center justify-center rounded-full bg-amber-500/15 font-bold text-amber-700">BW</div>
        <p className="text-sm text-muted-foreground">
          Betty lee el transcript y propone resultados con evidencia. Siempre los revisa un coordinador.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Coach</th>
              <th className="px-4 py-3">Nivel</th>
              <th className="px-4 py-3">Betty score</th>
              <th className="px-4 py-3">% alumnos</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td className="px-4 py-6 text-muted-foreground" colSpan={6}>Cargando…</td></tr>
            ) : (data ?? []).length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-muted-foreground" colSpan={6}>
                  <SearchCheck className="mx-auto mb-2 size-6" />
                  Todavía no hay análisis de Betty.
                </td>
              </tr>
            ) : (
              (data ?? []).map((row) => {
                const pct = (row.transcript_metrics as { students_pct?: number } | null)?.students_pct ?? null;
                return (
                  <tr key={row.id} className="border-t hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <Link to="/betty/$id" params={{ id: row.id }} className="font-medium hover:underline">
                        {row.class_date ? formatDateSV(row.class_date) : "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{(row.coach as { full_name?: string } | null)?.full_name ?? "—"}</td>
                    <td className="px-4 py-3">{row.level ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">{row.betty_score ?? "—"} {row.betty_phrase ? `· ${row.betty_phrase}` : ""}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${light(pct)}`}>{pct ?? "—"} %</span>
                    </td>
                    <td className="px-4 py-3 capitalize">{row.status}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
