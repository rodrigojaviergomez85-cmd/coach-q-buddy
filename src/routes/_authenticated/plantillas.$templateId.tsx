import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/plantillas/$templateId")({
  head: () => ({
    meta: [
      { title: "Detalle de plantilla · QA Coaches E4K" },
      {
        name: "description",
        content:
          "Ítems, secciones, áreas y puntajes de una plantilla de monitoreo de English4Kids.",
      },
      { property: "og:title", content: "Detalle de plantilla · QA Coaches E4K" },
      {
        property: "og:description",
        content: "Ítems, áreas y puntajes de la rúbrica de monitoreo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TemplateDetailPage,
  errorComponent: () => <p className="text-sm text-muted-foreground">Error</p>,
  notFoundComponent: () => <p className="text-sm text-muted-foreground">404</p>,
});

function TemplateDetailPage() {
  const { templateId } = Route.useParams();
  const { t } = useI18n();

  const templateQuery = useQuery({
    queryKey: ["template", templateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("templates")
        .select("id, code, name, subject, scoring, notes, active, has_student_grid")
        .eq("id", templateId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const itemsQuery = useQuery({
    queryKey: ["template-items", templateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("template_items")
        .select(
          "id, item_number, section, area, description, short_label, kind, points, area_points, penalty_kind, ss, sort_order",
        )
        .eq("template_id", templateId)
        .order("sort_order", { nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const template = templateQuery.data;
  const items = itemsQuery.data ?? [];
  const sections = Array.from(new Set(items.map((i) => i.section ?? "—")));

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/plantillas">
          <ArrowLeft className="size-4" />
          {t("back")}
        </Link>
      </Button>

      <PageHeader
        title={template?.name ?? t("loading")}
        subtitle={
          template
            ? `${template.code}${template.subject ? ` · ${template.subject}` : ""} · ${t("scoring")}: ${template.scoring ?? "—"}`
            : undefined
        }
      />

      {template?.notes ? (
        <p className="mb-6 rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
          {template.notes}
        </p>
      ) : null}

      {itemsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/60 px-6 py-16 text-center text-sm text-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map((section) => (
            <section key={section}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {section}
              </h2>
              <div className="overflow-hidden rounded-xl border bg-card shadow-panel">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">#</th>
                        <th className="px-4 py-3 font-medium">{t("description")}</th>
                        <th className="px-4 py-3 font-medium">{t("area")}</th>
                        <th className="px-4 py-3 font-medium">{t("kind")}</th>
                        <th className="px-4 py-3 text-right font-medium">{t("points")}</th>
                        <th className="px-4 py-3 text-right font-medium">{t("area_points")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {items
                        .filter((i) => (i.section ?? "—") === section)
                        .map((item) => (
                          <tr key={item.id} className="hover:bg-muted/40">
                            <td className="px-4 py-3 text-muted-foreground">
                              {item.item_number ?? "—"}
                            </td>
                            <td className="px-4 py-3">
                              <p>{item.description}</p>
                              {item.short_label ? (
                                <p className="text-xs text-muted-foreground">
                                  {item.short_label}
                                </p>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {item.area ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {item.penalty_kind ?? item.kind ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {item.points ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {item.area_points ?? "—"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
