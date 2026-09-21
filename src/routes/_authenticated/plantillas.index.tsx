import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/plantillas/")({
  head: () => ({
    meta: [
      { title: "Plantillas de monitoreo · QA Coaches E4K" },
      {
        name: "description",
        content:
          "Catálogo de plantillas de monitoreo de English4Kids con sus rúbricas, ítems y tipo de puntaje.",
      },
      { property: "og:title", content: "Plantillas de monitoreo · QA Coaches E4K" },
      {
        property: "og:description",
        content: "Rúbricas, ítems y tipos de puntaje de cada plantilla.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TemplatesPage,
});

function TemplatesPage() {
  const { t } = useI18n();
  const { isAdmin } = useProfile();
  const queryClient = useQueryClient();

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("templates").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("template_updated"));
      void queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });


  const templatesQuery = useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("templates")
        .select("id, code, name, subject, scoring, active, has_student_grid, sort_order")
        .order("sort_order", { nullsFirst: false })
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const countsQuery = useQuery({
    queryKey: ["template-item-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("template_items").select("template_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        if (row.template_id) counts[row.template_id] = (counts[row.template_id] ?? 0) + 1;
      }
      return counts;
    },
  });

  const templates = templatesQuery.data ?? [];

  return (
    <>
      <PageHeader title={t("templates_title")} subtitle={t("templates_subtitle")} />

      {templatesQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/60 px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">{t("no_templates")}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="group flex items-center justify-between gap-4 rounded-xl border bg-card px-5 py-4 shadow-panel transition-colors hover:border-primary/40"
            >
              <Link
                to="/plantillas/$templateId"
                params={{ templateId: tpl.id }}
                className="min-w-0 flex-1"
              >
                <p className="truncate text-sm font-semibold">{tpl.name}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {tpl.code}
                  {tpl.subject ? ` · ${tpl.subject}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-muted px-2 py-0.5">
                    {t("scoring")}: {tpl.scoring ?? "—"}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5">
                    {countsQuery.data?.[tpl.id] ?? 0} {t("items")}
                  </span>
                  {!tpl.active ? (
                    <span className="rounded-full chip-red px-2 py-0.5">{t("inactive")}</span>
                  ) : null}
                </div>
              </Link>
              {isAdmin ? (
                <Switch
                  checked={tpl.active}
                  disabled={toggleActive.isPending}
                  aria-label={t("active")}
                  onCheckedChange={(checked) =>
                    toggleActive.mutate({ id: tpl.id, active: checked })
                  }
                />
              ) : null}
              <Link to="/plantillas/$templateId" params={{ templateId: tpl.id }}>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
