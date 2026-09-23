import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Download, Upload, Users } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProfile } from "@/lib/auth";
import { COACHES_CSV_TEMPLATE, parseCoachNameCsv, type CoachNameParseResult, type CoachNameRow } from "@/lib/coach-name-import";
import { importCoachesByName, type ImportCoachResult } from "@/lib/users.functions";

export const Route = createFileRoute("/_authenticated/admin/users/import")({
  head: () => ({
    meta: [
      { title: "Importar coaches | QA Coaches E4K" },
      { name: "description", content: "Carga coaches desde un CSV y asígnalos a su coordinador." },
      { property: "og:title", content: "Importar coaches | QA Coaches E4K" },
      { property: "og:description", content: "Carga coaches desde un CSV y asígnalos a su coordinador." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ImportCoachesPage,
});

function downloadTemplate() {
  const blob = new Blob([COACHES_CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "coaches_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

const statusStyles: Record<ImportCoachResult["status"], { label: string; className: string }> = {
  created: { label: "Created", className: "bg-emerald-100 text-emerald-800" },
  updated: { label: "Updated", className: "bg-sky-100 text-sky-800" },
  error: { label: "Error", className: "bg-red-100 text-red-800" },
};

function ImportCoachesPage() {
  const { isAdmin } = useProfile();
  const queryClient = useQueryClient();
  const runImport = useServerFn(importCoachesByName);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<CoachNameParseResult | null>(null);
  const [results, setResults] = useState<ImportCoachResult[] | null>(null);

  const mutation = useMutation({
    mutationFn: async (rows: CoachNameRow[]) => runImport({ data: { rows } }),
    onSuccess: (data) => {
      setResults(data.results);
      setParsed(null);
      void queryClient.invalidateQueries();
      toast.success("Importación terminada");
    },
    onError: (error: Error) => toast.error(error.message || "No se pudo importar"),
  });

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Importar coaches" />
        <p className="text-sm text-muted-foreground">Solo admin y senior pueden importar coaches.</p>
      </>
    );
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    setResults(null);
    setParsed(parseCoachNameCsv(await file.text()));
  }

  const count = (s: ImportCoachResult["status"]) => results?.filter((r) => r.status === s).length ?? 0;

  return (
    <>
      <PageHeader
        title="Importar coaches"
        subtitle="Carga un CSV con nombre, rol y coordinador. Cada coach queda asignado a su coordinador."
        actions={
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="mr-2 size-4" /> Descargar plantilla CSV
          </Button>
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="size-4" /> Archivo CSV
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            type="file"
            accept=".csv,text/csv"
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <p className="text-xs text-muted-foreground">
            Columnas requeridas: <code>name,role,coordinator</code>. El rol debe ser <code>coach</code>; coordinator es el nombre completo del coordinador.
          </p>
          {fileName ? <p className="text-xs text-muted-foreground">Archivo: {fileName}</p> : null}
        </CardContent>
      </Card>

      {parsed ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4" /> Vista previa · {parsed.rows.length} coach(es)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {parsed.missingColumns.length > 0 ? (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
                Faltan columnas: {parsed.missingColumns.join(", ")}
              </div>
            ) : null}
            {parsed.errors.length > 0 ? (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
                <p className="font-medium">{parsed.errors.length} fila(s) con problemas:</p>
                <ul className="mt-1 list-disc pl-5">
                  {parsed.errors.map((e) => (
                    <li key={`${e.line}-${e.message}`}>Línea {e.line}: {e.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2">Coach Name</th>
                    <th className="py-2">Role</th>
                    <th className="py-2">Coordinator</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.map((row) => (
                    <tr key={row.name} className="border-t">
                      <td className="py-2">{row.name}</td>
                      <td className="py-2"><Badge variant="secondary">{row.role}</Badge></td>
                      <td className="py-2">{row.coordinator}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button disabled={parsed.rows.length === 0 || mutation.isPending} onClick={() => mutation.mutate(parsed.rows)}>
              {mutation.isPending ? "Importando…" : `Importar ${parsed.rows.length} coach(es)`}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {results ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Imported</CardTitle>
            <p className="text-sm text-muted-foreground">
              {count("created")} new coaches · {count("updated")} updated coaches · {count("error")} errors
            </p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">Coach Name</th>
                  <th className="py-2">Role</th>
                  <th className="py-2">Coordinator</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {results.map((row) => (
                  <tr key={row.name} className="border-t">
                    <td className="py-2">{row.name}</td>
                    <td className="py-2">{row.role}</td>
                    <td className="py-2">{row.coordinator}</td>
                    <td className="py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[row.status].className}`}>
                        {statusStyles[row.status].label}
                      </span>
                      {row.status === "error" && row.message ? (
                        <span className="ml-2 text-xs text-muted-foreground">{row.message}</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
