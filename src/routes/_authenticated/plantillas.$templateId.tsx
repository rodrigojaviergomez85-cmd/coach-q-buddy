import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/plantillas/$templateId")({
  head: () => ({
    meta: [
      { title: "Detalle de plantilla · QA Coaches E4K" },
      {
        name: "description",
        content:
          "Ítems, secciones, áreas y puntajes de una plantilla de monitoreo de English4Kids.",
      },
      { property: "og:title", content: "Detalle de plantilla · QA Coaches E4K" },
      {
        property: "og:description",
        content: "Ítems, áreas y puntajes de la rúbrica de monitoreo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TemplateDetailPage,
  errorComponent: () => <p className="text-sm text-muted-foreground">Error</p>,
  notFoundComponent: () => <p className="text-sm text-muted-foreground">404</p>,
});

const KINDS = ["item", "checklist", "penalty", "bonus"] as const;

type ItemDraft = {
  id: string | null;
  kind: string;
  section: string;
  area: string;
  item_number: string;
  short_label: string;
  description: string;
  points: string;
  area_points: string;
  sort_order: string;
};

function emptyDraft(): ItemDraft {
  return {
    id: null,
    kind: "item",
    section: "",
    area: "",
    item_number: "",
    short_label: "",
    description: "",
    points: "",
    area_points: "",
    sort_order: "",
  };
}

function toNum(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function TemplateDetailPage() {
  const { templateId } = Route.useParams();
  const { t } = useI18n();
  const { isAdmin } = useProfile();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState<ItemDraft | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const templateQuery = useQuery({
    queryKey: ["template", templateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("templates")
        .select("id, code, name, subject, scoring, notes, active, has_student_grid")
        .eq("id", templateId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const itemsQuery = useQuery({
    queryKey: ["template-items", templateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("template_items")
        .select(
          "id, item_number, section, area, description, short_label, kind, points, area_points, penalty_kind, ss, sort_order",
        )
        .eq("template_id", templateId)
        .order("sort_order", { nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["template-items", templateId] });
    void queryClient.invalidateQueries({ queryKey: ["template-item-counts"] });
  };

  const saveItem = useMutation({
    mutationFn: async (draft: ItemDraft) => {
      const payload = {
        description: draft.description.trim(),
        points: toNum(draft.points),
        area_points: toNum(draft.area_points),
        sort_order: toNum(draft.sort_order),
      };
      if (!payload.description) throw new Error(t("description"));
      if (draft.id) {
        const { error } = await supabase
          .from("template_items")
          .update(payload)
          .eq("id", draft.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("template_items").insert({
          ...payload,
          template_id: templateId,
          kind: draft.kind,
          section: draft.section.trim() || null,
          area: draft.area.trim() || null,
          item_number: draft.item_number.trim() || null,
          short_label: draft.short_label.trim() || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(t("item_saved"));
      setEditing(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("template_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("item_deleted"));
      setDeletingId(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const template = templateQuery.data;
  const items = itemsQuery.data ?? [];
  const sections = Array.from(new Set(items.map((i) => i.section ?? "—")));

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/plantillas">
          <ArrowLeft className="size-4" />
          {t("back")}
        </Link>
      </Button>

      <PageHeader
        title={template?.name ?? t("loading")}
        subtitle={
          template
            ? `${template.code}${template.subject ? ` · ${template.subject}` : ""} · ${t("scoring")}: ${template.scoring ?? "—"}`
            : undefined
        }
        action={
          isAdmin ? (
            <Button size="sm" onClick={() => setEditing(emptyDraft())}>
              <Plus className="size-4" />
              {t("add_item")}
            </Button>
          ) : undefined
        }
      />

      {template?.notes ? (
        <p className="mb-6 rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
          {template.notes}
        </p>
      ) : null}

      {itemsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/60 px-6 py-16 text-center text-sm text-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map((section) => (
            <section key={section}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {section}
              </h2>
              <div className="overflow-hidden rounded-xl border bg-card shadow-panel">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">#</th>
                        <th className="px-4 py-3 font-medium">{t("description")}</th>
                        <th className="px-4 py-3 font-medium">{t("area")}</th>
                        <th className="px-4 py-3 font-medium">{t("kind")}</th>
                        <th className="px-4 py-3 text-right font-medium">{t("points")}</th>
                        <th className="px-4 py-3 text-right font-medium">{t("area_points")}</th>
                        <th className="px-4 py-3 text-right font-medium">{t("sort_order")}</th>
                        {isAdmin ? <th className="px-4 py-3" /> : null}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {items
                        .filter((i) => (i.section ?? "—") === section)
                        .map((item) => (
                          <tr key={item.id} className="hover:bg-muted/40">
                            <td className="px-4 py-3 text-muted-foreground">
                              {item.item_number ?? "—"}
                            </td>
                            <td className="px-4 py-3">
                              <p>{item.description}</p>
                              {item.short_label ? (
                                <p className="text-xs text-muted-foreground">
                                  {item.short_label}
                                </p>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {item.area ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {item.penalty_kind ?? item.kind ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {item.points ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {item.area_points ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {item.sort_order ?? "—"}
                            </td>
                            {isAdmin ? (
                              <td className="px-4 py-3">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={t("edit_item")}
                                    onClick={() =>
                                      setEditing({
                                        id: item.id,
                                        kind: item.kind ?? "item",
                                        section: item.section ?? "",
                                        area: item.area ?? "",
                                        item_number: item.item_number ?? "",
                                        short_label: item.short_label ?? "",
                                        description: item.description ?? "",
                                        points: item.points?.toString() ?? "",
                                        area_points: item.area_points?.toString() ?? "",
                                        sort_order: item.sort_order?.toString() ?? "",
                                      })
                                    }
                                  >
                                    <Pencil className="size-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={t("delete")}
                                    onClick={() => setDeletingId(item.id)}
                                  >
                                    <Trash2 className="size-4 text-destructive" />
                                  </Button>
                                </div>
                              </td>
                            ) : null}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? t("edit_item") : t("new_item")}</DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="space-y-4">
              {!editing.id ? (
                <>
                  <div className="space-y-1.5">
                    <Label>{t("kind")}</Label>
                    <Select
                      value={editing.kind}
                      onValueChange={(value) => setEditing({ ...editing, kind: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {KINDS.map((kind) => (
                          <SelectItem key={kind} value={kind}>
                            {t(`kind_${kind}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>{t("section")}</Label>
                      <Input
                        value={editing.section}
                        onChange={(e) => setEditing({ ...editing, section: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t("area")}</Label>
                      <Input
                        value={editing.area}
                        onChange={(e) => setEditing({ ...editing, area: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t("item_number")}</Label>
                      <Input
                        value={editing.item_number}
                        onChange={(e) =>
                          setEditing({ ...editing, item_number: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t("short_label")}</Label>
                      <Input
                        value={editing.short_label}
                        onChange={(e) =>
                          setEditing({ ...editing, short_label: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </>
              ) : null}

              <div className="space-y-1.5">
                <Label>{t("description")}</Label>
                <Textarea
                  rows={3}
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>{t("points")}</Label>
                  <Input
                    inputMode="decimal"
                    value={editing.points}
                    onChange={(e) => setEditing({ ...editing, points: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("area_points")}</Label>
                  <Input
                    inputMode="decimal"
                    value={editing.area_points}
                    onChange={(e) => setEditing({ ...editing, area_points: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("sort_order")}</Label>
                  <Input
                    inputMode="numeric"
                    value={editing.sort_order}
                    onChange={(e) => setEditing({ ...editing, sort_order: e.target.value })}
                  />
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              {t("cancel")}
            </Button>
            <Button
              disabled={saveItem.isPending || !editing?.description.trim()}
              onClick={() => editing && saveItem.mutate(editing)}
            >
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deletingId !== null}
        onOpenChange={(open) => !open && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete_item_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("delete_item_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteItem.mutate(deletingId)}
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
