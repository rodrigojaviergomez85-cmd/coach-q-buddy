import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { matchAutoRule } from "@/lib/betty-metrics";
import { useProfile } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/betty/calibracion")({
  component: Calibracion,
  head: () => ({
    meta: [
      { title: "Calibración de Betty · QA Coaches E4K" },
      { name: "description", content: "Acuerdo entre Coach Betty Well y los coordinadores por ítem." },
      { property: "og:title", content: "Calibración de Betty · QA Coaches E4K" },
      { property: "og:description", content: "Acuerdo entre Coach Betty Well y los coordinadores por ítem." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

interface ItemRow {
  id: string;
  item_number: string | null;
  short_label: string | null;
  description: string;
  ai_mode: string | null;
  ai_instructions: string | null;
  sort_order: number | null;
}

interface TemplateGroup {
  id: string;
  name: string;
  code: string;
  active: boolean;
  items: ItemRow[];
}

function Calibracion() {
  const { profile } = useProfile();
  const allowed = profile.role === "admin" || profile.role === "senior";
  const isAdmin = profile.role === "admin";
  const [editing, setEditing] = useState<ItemRow | null>(null);
  const [mode, setMode] = useState("manual");
  const [instructions, setInstructions] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, refetch } = useQuery({
    enabled: allowed,
    queryKey: ["betty-calibracion"],
    queryFn: async () => {
      const [templatesRes, answersRes] = await Promise.all([
        supabase
          .from("templates")
          .select("id, name, code, active, items:template_items(id, item_number, short_label, description, ai_mode, ai_instructions, sort_order)")
          .eq("subject", "coach")
          .order("name"),
        supabase
          .from("betty_scan_answers")
          .select("item_id, ai_result, final_result, scan:betty_scans(status)")
          .not("final_result", "is", null),
      ]);
      if (templatesRes.error) throw templatesRes.error;
      if (answersRes.error) throw answersRes.error;

      const stats = new Map<string, { n: number; agree: number }>();
      for (const row of answersRes.data ?? []) {
        const scan = row.scan as unknown as { status: string } | null;
        if (!row.item_id || scan?.status === "analizado") continue;
        const current = stats.get(row.item_id) ?? { n: 0, agree: 0 };
        current.n += 1;
        const ai = row.ai_result === "parcial" ? "si" : row.ai_result;
        if (ai === row.final_result) current.agree += 1;
        stats.set(row.item_id, current);
      }

      const templates = ((templatesRes.data ?? []) as unknown as TemplateGroup[])
        .map((t) => ({
          ...t,
          items: [...(t.items ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
        }))
        .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));

      return { templates, stats };
    },
  });

  function openEdit(item: ItemRow) {
    setEditing(item);
    setMode(item.ai_mode ?? "manual");
    setInstructions(item.ai_instructions ?? "");
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("template_items")
        .update({ ai_mode: mode, ai_instructions: instructions.trim() || null })
        .eq("id", editing.id);
      if (error) throw error;
      toast.success("Ítem actualizado");
      setEditing(null);
      void refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  if (!allowed) return <p className="text-muted-foreground">Esta página es solo para admin y senior.</p>;

  return (
    <div className="space-y-6">
      <PageHeader title="Calibración de Betty" subtitle="Qué tanto coincide Betty con los coordinadores, plantilla por plantilla" />

      {(data?.templates ?? []).map((template) => (
        <section key={template.id} className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3">
            <h2 className="font-semibold">{template.name}</h2>
            <Badge variant="secondary">{template.code}</Badge>
            {template.active ? null : <Badge variant="outline">inactiva</Badge>}
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Ítem</th>
                <th className="px-4 py-2">Modo</th>
                <th className="px-4 py-2">Regla automática</th>
                <th className="px-4 py-2">Revisados</th>
                <th className="px-4 py-2">Acuerdo</th>
                <th className="px-4 py-2">Sugerencia</th>
                {isAdmin ? <th className="px-4 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {template.items.map((item) => {
                const stat = data?.stats.get(item.id) ?? { n: 0, agree: 0 };
                const pct = stat.n > 0 ? Math.round((stat.agree / stat.n) * 100) : 0;
                const hint = stat.n === 0 ? "—" : pct >= 85 && stat.n >= 20 ? "Candidato a auto" : pct < 60 ? "Revisar instrucciones" : "—";
                const rule = matchAutoRule(item.description);
                return (
                  <tr key={item.id} className="border-t align-top">
                    <td className="px-4 py-2">
                      <p className="font-medium">{item.item_number ?? item.short_label ?? "—"}</p>
                      <p className="max-w-md text-xs text-muted-foreground">{item.description}</p>
                    </td>
                    <td className="px-4 py-2">{item.ai_mode ?? "manual"}</td>
                    <td className="px-4 py-2">
                      {rule ? <Badge variant="outline">{rule.label}{rule.param ? ` (${rule.param})` : ""}</Badge> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2 tabular-nums">{stat.n}</td>
                    <td className="px-4 py-2 tabular-nums">{stat.n > 0 ? `${pct} %` : "—"}</td>
                    <td className="px-4 py-2"><Badge variant="secondary">{hint}</Badge></td>
                    {isAdmin ? (
                      <td className="px-4 py-2 text-right">
                        <Button size="sm" variant="outline" onClick={() => openEdit(item)}>Editar</Button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
              {template.items.length === 0 ? (
                <tr><td className="px-4 py-6 text-center text-muted-foreground" colSpan={isAdmin ? 7 : 6}>Esta plantilla no tiene ítems.</td></tr>
              ) : null}
            </tbody>
          </table>
        </section>
      ))}

      <Dialog open={editing !== null} onOpenChange={(open) => (open ? null : setEditing(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.item_number ?? editing?.short_label ?? "Ítem"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{editing?.description}</p>
          <div className="space-y-2">
            <Label>Modo de Betty</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">manual</SelectItem>
                <SelectItem value="suggest">suggest</SelectItem>
                <SelectItem value="auto">auto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Instrucciones para Betty</Label>
            <Textarea rows={5} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Si lo dejas vacío, Betty usa la descripción del ítem." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={() => void save()} disabled={saving}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
