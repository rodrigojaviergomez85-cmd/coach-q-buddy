import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/betty/calibracion")({
  component: Calibracion,
  head: () => ({
    meta: [
      { title: "Calibración de Betty · QA Coaches E4K" },
      { name: "description", content: "Acuerdo entre Coach Betty Well y los coordinadores por ítem." },
      { property: "og:title", content: "Calibración de Betty · QA Coaches E4K" },
      { property: "og:description", content: "Acuerdo entre Coach Betty Well y los coordinadores por ítem." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Calibracion() {
  const { profile } = useProfile();
  const allowed = profile.role === "admin" || profile.role === "senior";

  const { data } = useQuery({
    enabled: allowed,
    queryKey: ["betty-calibracion"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("betty_scan_answers")
        .select("ai_result, final_result, item:template_items(id, item_number, short_label, ai_mode, template:templates(code)), scan:betty_scans(status)")
        .not("final_result", "is", null);
      if (error) throw error;
      const map = new Map<string, { code: string; item: string; mode: string; n: number; agree: number }>();
      for (const row of data ?? []) {
        const item = row.item as unknown as { id: string; item_number: string | null; short_label: string | null; ai_mode: string | null; template: { code: string } | null } | null;
        const scan = row.scan as unknown as { status: string } | null;
        if (!item || scan?.status === "analizado") continue;
        const key = item.id;
        const current = map.get(key) ?? {
          code: item.template?.code ?? "—",
          item: item.item_number ?? item.short_label ?? "—",
          mode: item.ai_mode ?? "manual",
          n: 0,
          agree: 0,
        };
        current.n += 1;
        const ai = row.ai_result === "parcial" ? "si" : row.ai_result;
        if (ai === row.final_result) current.agree += 1;
        map.set(key, current);
      }
      return [...map.values()].sort((a, b) => b.n - a.n);
    },
  });

  if (!allowed) return <p className="text-muted-foreground">Esta página es solo para admin y senior.</p>;

  return (
    <div className="space-y-6">
      <PageHeader title="Calibración de Betty" subtitle="Qué tanto coincide Betty con los coordinadores" />
      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Plantilla</th>
              <th className="px-4 py-3">Ítem</th>
              <th className="px-4 py-3">Modo</th>
              <th className="px-4 py-3">Revisados</th>
              <th className="px-4 py-3">Acuerdo</th>
              <th className="px-4 py-3">Sugerencia</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((row) => {
              const pct = row.n > 0 ? Math.round((row.agree / row.n) * 100) : 0;
              const hint = pct >= 85 && row.n >= 20 ? "Candidato a auto" : pct < 60 ? "Revisar instrucciones" : "—";
              return (
                <tr key={`${row.code}-${row.item}`} className="border-t">
                  <td className="px-4 py-3">{row.code}</td>
                  <td className="px-4 py-3 font-medium">{row.item}</td>
                  <td className="px-4 py-3">{row.mode}</td>
                  <td className="px-4 py-3 tabular-nums">{row.n}</td>
                  <td className="px-4 py-3 tabular-nums">{pct} %</td>
                  <td className="px-4 py-3"><Badge variant="secondary">{hint}</Badge></td>
                </tr>
              );
            })}
            {(data ?? []).length === 0 ? (
              <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>Todavía no hay análisis revisados.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
