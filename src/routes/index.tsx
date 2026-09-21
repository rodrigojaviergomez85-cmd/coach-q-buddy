import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QA Coaches E4K" },
      {
        name: "description",
        content:
          "Herramienta interna de English4Kids para monitorear la calidad de las clases de los coaches.",
      },
      { property: "og:title", content: "QA Coaches E4K" },
      {
        property: "og:description",
        content: "Monitoreo de calidad de clases para coordinadores de English4Kids.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/coaches" });
  },
  component: () => null,
});
