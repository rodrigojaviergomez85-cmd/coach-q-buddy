import { createFileRoute, useParams } from "@tanstack/react-router";

import { BettyResult } from "@/components/betty/BettyResult";

export const Route = createFileRoute("/_authenticated/betty/$id")({
  component: BettyScanPage,
  head: () => ({
    meta: [
      { title: "Análisis de Betty · QA Coaches E4K" },
      { name: "description", content: "Resultado del análisis auxiliar de Coach Betty Well." },
      { property: "og:title", content: "Análisis de Betty · QA Coaches E4K" },
      { property: "og:description", content: "Resultado del análisis auxiliar de Coach Betty Well." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function BettyScanPage() {
  const { id } = useParams({ from: "/_authenticated/betty/$id" });
  return <BettyResult scanId={id} />;
}
