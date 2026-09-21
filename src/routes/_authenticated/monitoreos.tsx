import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/monitoreos")({
  head: () => ({
    meta: [
      { title: "Monitoreos · QA Coaches E4K" },
      {
        name: "description",
        content:
          "Listado de monitoreos de clases de English4Kids: puntajes, estatus y coach evaluado.",
      },
      { property: "og:title", content: "Monitoreos · QA Coaches E4K" },
      { property: "og:description", content: "Monitoreos de clases de English4Kids." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MonitoringsPage,
});

function MonitoringsPage() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t("monitorings_title")} />
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/60 px-6 py-20 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <ClipboardList className="size-6" />
        </div>
        <p className="mt-4 max-w-md text-sm text-muted-foreground">
          {t("monitorings_placeholder")}
        </p>
      </div>
    </>
  );
}
