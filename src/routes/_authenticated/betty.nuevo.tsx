import { createFileRoute } from "@tanstack/react-router";

import { BettyWizard } from "@/components/betty/BettyWizard";
import { PageHeader } from "@/components/layout/PageHeader";

export const Route = createFileRoute("/_authenticated/betty/nuevo")({
  component: NuevoBetty,
  head: () => ({
    meta: [
      { title: "Nuevo análisis de Betty · QA Coaches E4K" },
      { name: "description", content: "Analiza el transcript de una clase con Coach Betty Well." },
      { property: "og:title", content: "Nuevo análisis de Betty · QA Coaches E4K" },
      { property: "og:description", content: "Analiza el transcript de una clase con Coach Betty Well." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function NuevoBetty() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Nuevo análisis de Betty"
        subtitle="Auxiliar · sus resultados no son oficiales"
      />
      <BettyWizard />
    </div>
  );
}
