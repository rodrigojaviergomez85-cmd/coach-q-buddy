import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Pencil, Plus, Upload } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { monthStartSV, nextMonthStartSV } from "@/lib/date";
import { cn } from "@/lib/utils";
import { detectCsvFormat, mapTeachersListRow, normalizeName } from "@/lib/coach-import";

export const Route = createFileRoute("/_authenticated/coaches")({
  head: () => ({
    meta: [
      { title: "Mis coaches · QA Coaches E4K" },
      {
        name: "description",
        content:
          "Catálogo de coaches de English4Kids con su coordinador, nivel, horario y avance de monitoreos del mes.",
      },
      { property: "og:title", content: "Mis coaches · QA Coaches E4K" },
      {
        property: "og:description",
        content: "Catálogo de coaches y avance de monitoreos del mes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CoachesPage,
});

interface CoachRow {
  id: string;
  full_name: string;
  email: string | null;
  coordinator_id: string | null;
  coordinator_name?: string | null;
  senior_name: string | null;
  lob: string | null;
  level: string | null;
  schedule: string | null;
  active: boolean;
  notes: string | null;
  country?: string | null;
  csat_level?: string | null;
  tenure_months?: number | null;
  phone?: string | null;
}

const emptyCoach: Omit<CoachRow, "id"> = {
  full_name: "",
  email: "",
  coordinator_id: null,
  senior_name: "",
  lob: "",
  level: "",
  schedule: "",
  active: true,
  notes: "",
};

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const header = (rows.shift() ?? []).map((h) => h.trim().toLowerCase());
  return rows
    .filter((r) => r.some((cell) => cell.trim() !== ""))
    .map((r) => {
      const obj: Record<string, string> = {};
      header.forEach((key, idx) => {
        obj[key] = (r[idx] ?? "").trim();
      });
      return obj;
    });
}

function CoachesPage() {
  const { t } = useI18n();
  const { profile, canSeeAll, isAdmin } = useProfile();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("active");
  const [editing, setEditing] = useState<(Omit<CoachRow, "id"> & { id?: string }) | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const coachesQuery = useQuery({
    queryKey: ["coaches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coaches")
        .select(
          "id, full_name, email, coordinator_id, coordinator_name, senior_name, lob, level, schedule, active, notes, country, csat_level, tenure_months, phone, external_id",
        )
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as CoachRow[];
    },
  });

  const profilesQuery = useQuery({
    queryKey: ["profiles-lite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, role")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const configQuery = useQuery({
    queryKey: ["app-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_config").select("key, value");
      if (error) throw error;
      return data ?? [];
    },
  });

  const countsQuery = useQuery({
    queryKey: ["monitoring-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monitorings")
        .select("coach_id")
        .eq("status", "enviado")
        .gte("qa_date", monthStartSV())
        .lt("qa_date", nextMonthStartSV());
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        if (row.coach_id) counts[row.coach_id] = (counts[row.coach_id] ?? 0) + 1;
      }
      return counts;
    },
  });

  const target = Number(
    configQuery.data?.find((c) => c.key === "monthly_target")?.value ?? 2,
  );

  const coordinatorName = (id: string | null) => {
    if (!id) return t("none");
    const found = profilesQuery.data?.find((p) => p.id === id);
    return found?.full_name || found?.email || t("none");
  };

  const rows = useMemo(() => {
    const list = coachesQuery.data ?? [];
    return list.filter((c) => {
      const matchesSearch = c.full_name.toLowerCase().includes(search.trim().toLowerCase());
      const matchesStatus =
        statusFilter === "all" ? true : statusFilter === "active" ? c.active : !c.active;
      return matchesSearch && matchesStatus;
    });
  }, [coachesQuery.data, search, statusFilter]);

  const saveMutation = useMutation({
    mutationFn: async (coach: Omit<CoachRow, "id"> & { id?: string }) => {
      const payload = {
        full_name: coach.full_name.trim(),
        email: coach.email?.trim() || null,
        coordinator_id: coach.coordinator_id,
        senior_name: coach.senior_name?.trim() || null,
        lob: coach.lob?.trim() || null,
        level: coach.level?.trim() || null,
        schedule: coach.schedule?.trim() || null,
        active: coach.active,
        notes: coach.notes?.trim() || null,
      };
      if (coach.id) {
        const { error } = await supabase.from("coaches").update(payload).eq("id", coach.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("coaches").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(t("coach_saved"));
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ["coaches"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("coaches").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["coaches"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  type ImportPayload = Record<string, unknown> & { full_name: string; external_id?: string | null };

  async function handleImport(file: File) {
    const text = (await file.text()).replace(/^\uFEFF/, "");
    const records = parseCsv(text);
    if (records.length === 0) {
      setImportSummary("El archivo no tiene filas.");
      setImportOpen(true);
      return;
    }
    const format = detectCsvFormat(Object.keys(records[0] ?? {}));

    const { data: freshCoaches, error: freshError } = await supabase
      .from("coaches")
      .select("id, full_name, external_id");
    if (freshError) {
      setImportSummary(`No se pudo leer la lista de coaches: ${freshError.message}`);
      setImportOpen(true);
      return;
    }
    const byExternal = new Map<string, string>();
    const byName = new Map<string, string>();
    for (const coach of freshCoaches ?? []) {
      if (coach.external_id) byExternal.set(coach.external_id, coach.id);
      byName.set(normalizeName(coach.full_name), coach.id);
    }

    let created = 0;
    let updated = 0;
    let failed = 0;
    const remember = (id: string, fullName: string, externalId?: string | null) => {
      byName.set(normalizeName(fullName), id);
      if (externalId) byExternal.set(externalId, id);
    };

    async function saveRow(payload: ImportPayload) {
      const existingId =
        (payload.external_id ? byExternal.get(payload.external_id) : undefined) ??
        byName.get(normalizeName(payload.full_name));
      if (existingId) {
        const { error } = await supabase.from("coaches").update(payload).eq("id", existingId);
        if (error) {
          failed += 1;
          return;
        }
        remember(existingId, payload.full_name, payload.external_id ?? null);
        updated += 1;
        return;
      }
      const { data, error } = await supabase.from("coaches").insert(payload).select("id").single();
      if (!error && data) {
        remember(data.id, payload.full_name, payload.external_id ?? null);
        created += 1;
        return;
      }
      if (error && (error as { code?: string }).code === "23505") {
        const { data: found } = await supabase
          .from("coaches")
          .select("id")
          .ilike("full_name", payload.full_name)
          .limit(1)
          .maybeSingle();
        if (found) {
          const { error: updateError } = await supabase
            .from("coaches")
            .update(payload)
            .eq("id", found.id);
          if (!updateError) {
            remember(found.id, payload.full_name, payload.external_id ?? null);
            updated += 1;
            return;
          }
        }
      }
      failed += 1;
    }

    async function saveBatch(batch: ImportPayload[]) {
      const withExternal = batch.filter((row) => row.external_id);
      const rest = batch.filter((row) => !row.external_id);
      if (withExternal.length) {
        const { data, error } = await supabase
          .from("coaches")
          .upsert(withExternal, { onConflict: "external_id" })
          .select("id, full_name, external_id");
        if (error) {
          for (const row of withExternal) await saveRow(row);
        } else {
          for (const row of withExternal) {
            const existed =
              byExternal.has(row.external_id as string) ||
              byName.has(normalizeName(row.full_name));
            if (existed) updated += 1;
            else created += 1;
          }
          for (const row of data ?? []) remember(row.id, row.full_name, row.external_id);
        }
      }
      for (const row of rest) await saveRow(row);
    }

    async function runBatches(payloads: ImportPayload[]) {
      for (let i = 0; i < payloads.length; i += 50) {
        await saveBatch(payloads.slice(i, i + 50));
      }
    }

    if (format === "teachers_list") {
      const profilesByName = new Map(
        (profilesQuery.data ?? []).map((p) => [normalizeName(p.full_name), p.id] as const),
      );
      const coordinators = new Set<string>();
      const linked = new Set<string>();
      const unlinked = new Set<string>();
      const payloads: ImportPayload[] = [];

      for (const record of records) {
        const row = mapTeachersListRow(record);
        if (!row) continue;
        const coordinatorId = row.coordinator_name
          ? (profilesByName.get(normalizeName(row.coordinator_name)) ?? null)
          : null;
        if (row.coordinator_name) {
          coordinators.add(row.coordinator_name);
          if (coordinatorId) linked.add(row.coordinator_name);
          else unlinked.add(row.coordinator_name);
        }
        payloads.push({ ...row, coordinator_id: coordinatorId });
      }

      await runBatches(payloads);

      const missing = [...unlinked].sort();
      setImportSummary(
        `${created + updated} coaches importados (${created} nuevos, ${updated} actualizados, ${failed} con error). ` +
          `${coordinators.size} coordinadores detectados, ${linked.size} ya vinculados a un usuario, ` +
          `${missing.length} sin usuario${missing.length ? `: ${missing.join(", ")}` : "."}`,
      );
      setImportOpen(true);
      await queryClient.invalidateQueries({ queryKey: ["coaches"] });
      return;
    }

    const profilesByEmail = new Map(
      (profilesQuery.data ?? []).map((p) => [p.email.toLowerCase(), p.id] as const),
    );
    const missing: string[] = [];
    const payloads: ImportPayload[] = [];

    for (const record of records) {
      const fullName = record["full_name"];
      if (!fullName) continue;
      const coordEmail = (record["coordinator_email"] ?? "").toLowerCase();
      const coordinatorId = coordEmail ? (profilesByEmail.get(coordEmail) ?? null) : null;
      if (!coordinatorId) missing.push(fullName);
      payloads.push({
        full_name: fullName.trim(),
        email: record["email"] || null,
        coordinator_id: coordinatorId,
        senior_name: record["senior_name"] || null,
        lob: record["lob"] || null,
        level: record["level"] || null,
        schedule: record["schedule"] || null,
      });
    }

    await runBatches(payloads);

    setImportSummary(
      `${created + updated} ${t("csv_imported")} (${created} nuevos, ${updated} actualizados, ${failed} con error).` +
        (missing.length ? ` ${missing.length} ${t("csv_no_coordinator")}: ${missing.join(", ")}` : ""),
    );
    setImportOpen(true);
    await queryClient.invalidateQueries({ queryKey: ["coaches"] });
  }

  return (
    <>
      <PageHeader
        title={t("coaches_title")}
        subtitle={t("coaches_subtitle")}
        actions={
          <>
            {canSeeAll ? (
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="size-4" />
                {t("import_csv")}
              </Button>
            ) : null}
            <Button
              onClick={() =>
                setEditing({ ...emptyCoach, coordinator_id: canSeeAll ? null : profile.id })
              }
            >
              <Plus className="size-4" />
              {t("new_coach")}
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("search_by_name")}
          className="sm:max-w-xs"
        />
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">{t("active")}</SelectItem>
            <SelectItem value="inactive">{t("inactive")}</SelectItem>
            <SelectItem value="all">{t("all")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-panel">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t("full_name")}</th>
                <th className="px-4 py-3 font-medium">{t("lob")}</th>
                <th className="px-4 py-3 font-medium">{t("level")}</th>
                <th className="px-4 py-3 font-medium">País</th>
                <th className="px-4 py-3 font-medium">CSAT</th>
                <th className="px-4 py-3 font-medium">Antigüedad</th>
                <th className="px-4 py-3 font-medium">Teléfono</th>
                <th className="px-4 py-3 font-medium">{t("schedule")}</th>
                {canSeeAll ? (
                  <th className="px-4 py-3 font-medium">{t("coordinator")}</th>
                ) : null}
                <th className="px-4 py-3 font-medium">{t("monitorings_this_month")}</th>
                <th className="px-4 py-3 font-medium">{t("active")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {coachesQuery.isLoading ? (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center text-muted-foreground">
                    {t("loading")}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center text-muted-foreground">
                    {t("empty")}
                  </td>
                </tr>
              ) : (
                rows.map((coach) => {
                  const count = countsQuery.data?.[coach.id] ?? 0;
                  const chip =
                    count >= target ? "chip-green" : count >= 1 ? "chip-yellow" : "chip-red";
                  return (
                    <tr key={coach.id} className="hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <Link to="/coaches/$coachId" params={{ coachId: coach.id }} className="font-medium text-primary hover:underline">{coach.full_name}</Link>
                        {coach.email ? (
                          <p className="text-xs text-muted-foreground">{coach.email}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{coach.lob || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{coach.level || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{coach.country || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{coach.csat_level || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {coach.tenure_months != null ? `${Number(coach.tenure_months).toFixed(0)} m` : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{coach.phone || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{coach.schedule || "—"}</td>
                      {canSeeAll ? (
                        <td className="px-4 py-3 text-muted-foreground">
                          {coordinatorName(coach.coordinator_id)}
                        </td>
                      ) : null}
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                            chip,
                          )}
                        >
                          {count} / {target}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Switch
                          checked={coach.active}
                          onCheckedChange={(active) =>
                            toggleActive.mutate({ id: coach.id, active })
                          }
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="icon" onClick={() => setEditing(coach)}>
                          <Pencil className="size-4" />
                          <span className="sr-only">{t("edit")}</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? t("edit_coach") : t("new_coach")}</DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("full_name")}</Label>
                <Input
                  value={editing.full_name}
                  onChange={(e) => setEditing({ ...editing, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("email")}</Label>
                <Input
                  value={editing.email ?? ""}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("lob")}</Label>
                  <Input
                    value={editing.lob ?? ""}
                    onChange={(e) => setEditing({ ...editing, lob: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("level")}</Label>
                  <Input
                    value={editing.level ?? ""}
                    onChange={(e) => setEditing({ ...editing, level: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("schedule")}</Label>
                  <Input
                    value={editing.schedule ?? ""}
                    onChange={(e) => setEditing({ ...editing, schedule: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("senior_name")}</Label>
                  <Input
                    value={editing.senior_name ?? ""}
                    onChange={(e) => setEditing({ ...editing, senior_name: e.target.value })}
                  />
                </div>
              </div>
              {canSeeAll ? (
                <div className="space-y-2">
                  <Label>{t("coordinator")}</Label>
                  <Select
                    value={editing.coordinator_id ?? "none"}
                    onValueChange={(v) =>
                      setEditing({ ...editing, coordinator_id: v === "none" ? null : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("none")}</SelectItem>
                      {(profilesQuery.data ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name || p.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div className="space-y-2">
                <Label>{t("notes")}</Label>
                <Textarea
                  value={editing.notes ?? ""}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={editing.active}
                  onCheckedChange={(active) => setEditing({ ...editing, active })}
                />
                <Label>{t("active")}</Label>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              {t("cancel")}
            </Button>
            <Button
              disabled={!editing?.full_name.trim() || saveMutation.isPending}
              onClick={() => editing && saveMutation.mutate(editing)}
            >
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={importOpen}
        onOpenChange={(open) => {
          setImportOpen(open);
          if (!open) setImportSummary(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("csv_import_title")}</DialogTitle>
            <DialogDescription>{t("csv_help")}</DialogDescription>
          </DialogHeader>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImport(file);
            }}
          />
          {importSummary ? (
            <p className="rounded-lg bg-muted px-3 py-2 text-sm">{importSummary}</p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              {isAdmin || canSeeAll ? t("cancel") : t("back")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
