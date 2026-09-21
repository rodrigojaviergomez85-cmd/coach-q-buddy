import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/layout/PageHeader";
import { TranscriptAnalyzer } from "@/components/transcript/TranscriptAnalyzer";

export const Route = createFileRoute("/_authenticated/analizador")({
  head: () => ({
    meta: [
      { title: "Analizador de transcript · QA Coaches E4K" },
      {
        name: "description",
        content:
          "Analiza el transcript de una clase de Zoom y mide el tiempo de habla del coach y de los alumnos.",
      },
      { property: "og:title", content: "Analizador de transcript · QA Coaches E4K" },
      {
        property: "og:description",
        content: "Talk time de coach y alumnos, silencios y participación por alumno.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyzerPage,
  errorComponent: () => <p className="text-sm text-muted-foreground">Error</p>,
  notFoundComponent: () => <p className="text-sm text-muted-foreground">404</p>,
});

function AnalyzerPage() {
  return (
    <>
      <PageHeader
        title="Analizador de transcript"
        subtitle="Pega el transcript de Zoom para medir la participación de coach y alumnos. Todo se calcula en tu navegador."
      />
      <TranscriptAnalyzer />
    </>
  );
}
