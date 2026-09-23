import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Download, Upload, Users } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProfile } from "@/lib/auth";
import {
  ROLE_LABELS,
  USERS_CSV_TEMPLATE,
  parseUsersCsv,
  type ParsedUserRow,
  type UserImportParseResult,
} from "@/lib/user-import";
import { importUsers, type ImportUserResult } from "@/lib/users.functions";

export const Route = createFileRoute("/_authenticated/admin/users/import")({
  head: () => ({
    meta: [
      { title: "Importar usuarios | QA Coaches E4K" },
      { name: "description", content: "Carga usuarios nuevos desde un archivo CSV e invítalos por correo." },
      { property: "og:title", content: "Importar usuarios | QA Coaches E4K" },
      { property: "og:description", content: "Carga usuarios nuevos desde un archivo CSV e invítalos por correo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ImportUsersPage,
});

function downloadTemplate() {
  const blob = new Blob([USERS_CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "users_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

const statusStyles: Record<ImportUserResult["status"], { label: string; className: string }> = {
  created: { label: "Created", className: "bg-emerald-100 text-emerald-800" },
  exists: { label: "Ya existe", className: "bg-amber-100 text-amber-900" },
  error: { label: "Error", className: "bg-red-100 text-red-800" },
};

function ImportUsersPage() {
  const { isAdmin } = useProfile();
  const queryClient = useQueryClient();
  const runImport = useServerFn(importUsers);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<UserImportParseResult | null>(null);
  const [results, setResults] = useState<ImportUserResult[] | null>(null);
  const { data: knownEmails } = useQuery({
    queryKey: ["profiles", "emails"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("email");
      if (error) throw error;
      return new Set((data ?? []).map((p) => p.email.toLowerCase()));
    },
  });

  const mutation = useMutation({
    mutationFn: async (rows: ParsedUserRow[]) =>
      runImport({
        data: {
          rows,
          redirectTo: typeof window !== "undefined" ? `${window.location.origin}/login` : undefined,
        },
      }),
    onSuccess: (data) => {
      setResults(data.results);
      setParsed(null);
      void queryClient.invalidateQueries({ queryKey: ["profiles"] });
      const ok = data.results.filter((r) => r.status === "created").length;
      toast.success(`${ok} usuario(s) creado(s) de ${data.results.length} filas`);
    },
    onError: (error: Error) => toast.error(error.message || "No se pudo importar"),
  });

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Importar usuarios" />
        <p className="text-sm text-muted-foreground">Solo admin y senior pueden importar usuarios.</p>
      </>
    );
  }

  async function handleFile(file: File) {
    const text = await file.text();
    setFileName(file.name);
    setResults(null);
    setParsed(parseUsersCsv(text));
  }

  return (
    <>
      <PageHeader
        title="Importar usuarios"
        subtitle="Carga un CSV con nombre, correo y rol. Los usuarios se crean activos con una contraseña temporal que solo se muestra en esta pantalla."
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
            Columnas esperadas: <code>name,email,role,team,coordinator_email</code> (team y coordinator_email opcionales). Roles válidos: admin, senior, coordinator, coach, qa.
          </p>
          {fileName ? <p className="text-xs text-muted-foreground">Archivo: {fileName}</p> : null}
        </CardContent>
      </Card>

      {parsed ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4" /> Vista previa · {parsed.rows.length} usuario(s)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {parsed.errors.length > 0 ? (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
                <p className="font-medium">{parsed.errors.length} fila(s) con problemas:</p>
                <ul className="mt-1 list-disc pl-5">
                  {parsed.errors.map((e) => (
                    <li key={`${e.line}-${e.message}`}>
                      Línea {e.line}: {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2">Nombre</th>
                    <th className="py-2">Email</th>
                    <th className="py-2">Rol</th>
                    <th className="py-2">Team</th>
                    <th className="py-2">Coordinator Email</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.map((row) => (
                    <tr key={row.email} className="border-t">
                      <td className="py-2">{row.name}</td>
                      <td className="py-2">{row.email}</td>
                      <td className="py-2">
                        <Badge variant="secondary">{ROLE_LABELS[row.role]}</Badge>
                      </td>
                      <td className="py-2">{row.team ?? "—"}</td>
                      <td className="py-2">
                        {row.coordinator_email ?? "—"}
                        {row.coordinator_email && knownEmails && !knownEmails.has(row.coordinator_email) ? (
                          <span className="ml-2 text-xs text-destructive">No existe</span>
                        ) : null}
                        {knownEmails?.has(row.email) ? (
                          <span className="ml-2 text-xs text-muted-foreground">(correo ya registrado)</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button
              disabled={parsed.rows.length === 0 || mutation.isPending}
              onClick={() => mutation.mutate(parsed.rows)}
            >
              {mutation.isPending ? "Importando…" : `Importar ${parsed.rows.length} usuario(s)`}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {results ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resultado</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">Nombre</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Rol</th>
                  <th className="py-2">Temporary Password</th>
                  <th className="py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {results.map((row) => (
                  <tr key={row.email} className="border-t">
                    <td className="py-2">{row.name}</td>
                    <td className="py-2">{row.email}</td>
                    <td className="py-2">{row.role}</td>
                    <td className="py-2 font-mono text-xs">{row.tempPassword ?? "—"}</td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[row.status].className}`}
                      >
                        {statusStyles[row.status].label}
                      </span>
                      {row.message && row.status === "error" ? (
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
