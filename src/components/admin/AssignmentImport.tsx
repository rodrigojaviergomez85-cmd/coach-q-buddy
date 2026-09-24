import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseAssignmentCsv, type AssignmentRow } from "@/lib/assignment-import";
import { importAssignments, type AssignResult } from "@/lib/users.functions";

const styles: Record<AssignResult["status"], { label: string; className: string }> = {
  assigned: { label: "Assigned", className: "bg-emerald-100 text-emerald-800" },
  updated: { label: "Updated", className: "bg-sky-100 text-sky-800" },
  unchanged: { label: "Sin cambios", className: "bg-muted text-muted-foreground" },
  error: { label: "Error", className: "bg-red-100 text-red-800" },
};

export function AssignmentImport() {
  const run = useServerFn(importAssignments);
  const qc = useQueryClient();
  const [rows, setRows] = useState<AssignmentRow[] | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [results, setResults] = useState<AssignResult[] | null>(null);

  const m = useMutation({
    mutationFn: async (r: AssignmentRow[]) => run({ data: { rows: r } }),
    onSuccess: (d) => { setResults(d.results); setRows(null); void qc.invalidateQueries(); toast.success("Asignaciones importadas"); },
    onError: (e: Error) => toast.error(e.message || "No se pudo importar"),
  });

  const count = (s: AssignResult["status"]) => results?.filter((r) => r.status === s).length ?? 0;

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Link2 className="size-4" /> Asignar coaches (Coach, Coordinator, Senior)</CardTitle>
        <p className="text-sm text-muted-foreground">Solo enlaza coaches existentes con su coordinador y senior. No crea usuarios.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          type="file"
          accept=".csv,text/csv"
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const p = parseAssignmentCsv(await f.text());
            setResults(null); setMissing(p.missingColumns); setRows(p.rows);
          }}
        />
        {missing.length ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">Faltan columnas: {missing.join(", ")}</p> : null}
        {rows && !missing.length ? (
          <>
            <div className="max-h-80 overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-2">Coach</th><th>Coordinator</th><th>Senior</th></tr></thead>
                <tbody>{rows.map((r, i) => <tr key={i} className="border-t"><td className="py-1.5">{r.coach}</td><td>{r.coordinator}</td><td>{r.senior}</td></tr>)}</tbody>
              </table>
            </div>
            <Button disabled={!rows.length || m.isPending} onClick={() => m.mutate(rows)}>
              {m.isPending ? "Asignando…" : `Asignar ${rows.length} coach(es)`}
            </Button>
          </>
        ) : null}
        {results ? (
          <>
            <p className="text-sm font-medium">Assigned: {count("assigned")} coaches · Updated: {count("updated")} assignments · Errors: {count("error")}{count("unchanged") ? ` · Sin cambios: ${count("unchanged")}` : ""}</p>
            <div className="max-h-[32rem] overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-2">Coach</th><th>Coordinator</th><th>Senior</th><th>Status</th></tr></thead>
                <tbody>
                  {[...results].sort((a, b) => (a.status === "error" ? -1 : 0) - (b.status === "error" ? -1 : 0)).map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="py-1.5">{r.coach}</td><td>{r.coordinator}</td><td>{r.senior}</td>
                      <td>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[r.status].className}`}>{styles[r.status].label}</span>
                        {r.message ? <span className="ml-2 text-xs text-muted-foreground">{r.message}</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
