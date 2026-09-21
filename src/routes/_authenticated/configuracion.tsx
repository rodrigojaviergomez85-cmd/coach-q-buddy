import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

export const Route = createFileRoute("/_authenticated/configuracion")({
  head: () => ({
    meta: [
      { title: "Configuración · QA Coaches E4K" },
      {
        name: "description",
        content:
          "Parámetros de calidad y gestión de usuarios autorizados de QA Coaches E4K.",
      },
      { property: "og:title", content: "Configuración · QA Coaches E4K" },
      { property: "og:description", content: "Parámetros de calidad y usuarios autorizados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

const booleanKeys = ["coach_sees_score"];
const numericKeys = ["monthly_target", "penalty_cap", "bonus_max", "green_min", "yellow_min", "talk_time_green", "talk_time_yellow", "student_min_pct", "af_min_students", "coach_response_days"];

function SettingsPage() {
  const { t } = useI18n();
  const { isAdmin } = useProfile();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [newUser, setNewUser] = useState({ email: "", full_name: "", role: "coordinador" });

  const configQuery = useQuery({
    queryKey: ["app-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_config")
        .select("key, value, description")
        .order("key");
      if (error) throw error;
      return data ?? [];
    },
  });

  const usersQuery = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, active")
        .order("email");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!configQuery.data) return;
    const next: Record<string, string> = {};
    for (const row of configQuery.data) {
      next[row.key] = typeof row.value === "string" ? row.value : JSON.stringify(row.value ?? "");
    }
    setValues(next);
  }, [configQuery.data]);

  const saveConfig = useMutation({
    mutationFn: async () => {
      for (const [key, raw] of Object.entries(values)) {
        const value = booleanKeys.includes(key) ? raw === "true" : numericKeys.includes(key) ? Number(raw) : raw;
        const { error } = await supabase.from("app_config").update({ value }).eq("key", key);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(t("saved"));
      void queryClient.invalidateQueries({ queryKey: ["app-config"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addUser = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").insert({
        email: newUser.email.trim().toLowerCase(),
        full_name: newUser.full_name.trim() || null,
        role: newUser.role,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("user_added"));
      setNewUser({ email: "", full_name: "", role: "coordinador" });
      void queryClient.invalidateQueries({ queryKey: ["profiles"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateUser = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: { role?: string; active?: boolean };
    }) => {
      const { error } = await supabase.from("profiles").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["profiles"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  if (!isAdmin) {
    return (
      <>
        <PageHeader title={t("settings_title")} />
        <p className="text-sm text-muted-foreground">{t("admin_only")}</p>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("settings_title")} />

      <section className="mb-8 rounded-xl border bg-card p-5 shadow-panel">
        <h2 className="mb-4 text-sm font-semibold">{t("settings_params")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {(configQuery.data ?? []).map((row) => (
            <div key={row.key} className="space-y-2">
              <Label htmlFor={row.key}>{row.description || row.key}</Label>
              {booleanKeys.includes(row.key) ? (
                <div className="flex h-10 items-center">
                  <Switch
                    id={row.key}
                    checked={values[row.key] === "true"}
                    onCheckedChange={(checked) => setValues((v) => ({ ...v, [row.key]: checked ? "true" : "false" }))}
                  />
                </div>
              ) : (
                <Input
                  id={row.key}
                  value={values[row.key] ?? ""}
                  inputMode={numericKeys.includes(row.key) ? "decimal" : "text"}
                  onChange={(e) => setValues((v) => ({ ...v, [row.key]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-5">
          <Button disabled={saveConfig.isPending} onClick={() => saveConfig.mutate()}>
            {t("save")}
          </Button>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5 shadow-panel">
        <h2 className="mb-4 text-sm font-semibold">{t("settings_users")}</h2>

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_160px_auto] sm:items-end">
          <div className="space-y-2">
            <Label>{t("email")}</Label>
            <Input
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("full_name")}</Label>
            <Input
              value={newUser.full_name}
              onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("role")}</Label>
            <Select
              value={newUser.role}
              onValueChange={(role) => setNewUser({ ...newUser, role })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="coordinador">{t("role_coordinador")}</SelectItem>
                <SelectItem value="senior">{t("role_senior")}</SelectItem>
                <SelectItem value="admin">{t("role_admin")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            disabled={!newUser.email.trim() || addUser.isPending}
            onClick={() => addUser.mutate()}
          >
            {t("add_user")}
          </Button>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t("email")}</th>
                <th className="px-4 py-3 font-medium">{t("full_name")}</th>
                <th className="px-4 py-3 font-medium">{t("role")}</th>
                <th className="px-4 py-3 font-medium">{t("active")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(usersQuery.data ?? []).map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{user.full_name || "—"}</td>
                  <td className="px-4 py-3">
                    <Select
                      value={user.role}
                      onValueChange={(role) => updateUser.mutate({ id: user.id, patch: { role } })}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="coordinador">{t("role_coordinador")}</SelectItem>
                        <SelectItem value="senior">{t("role_senior")}</SelectItem>
                        <SelectItem value="admin">{t("role_admin")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <Switch
                      checked={user.active}
                      onCheckedChange={(active) =>
                        updateUser.mutate({ id: user.id, patch: { active } })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <PendingPeople />
    </>
  );
}

function PendingPeople() {
  const queryClient = useQueryClient();
  const [emails, setEmails] = useState<Record<string, string>>({});

  const coachesQuery = useQuery({
    queryKey: ["coaches-people"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coaches")
        .select("coordinator_id, coordinator_name, senior_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = coachesQuery.data ?? [];
  const pendingCoordinators = [
    ...new Set(
      rows
        .filter((r) => !r.coordinator_id && r.coordinator_name)
        .map((r) => r.coordinator_name as string),
    ),
  ].sort();
  const seniors = [
    ...new Set(rows.flatMap((r) => (r.senior_name ? [r.senior_name] : []))),
  ].sort();

  const createUser = useMutation({
    mutationFn: async ({
      name,
      role,
      link,
    }: {
      name: string;
      role: "coordinador" | "senior";
      link: boolean;
    }) => {
      const email = (emails[`${role}:${name}`] ?? "").trim().toLowerCase();
      if (!email) throw new Error("Escribe un correo");
      const { data, error } = await supabase
        .from("profiles")
        .insert({ email, full_name: name, role })
        .select("id")
        .single();
      if (error) throw error;
      if (link && data) {
        const { error: linkError } = await supabase
          .from("coaches")
          .update({ coordinator_id: data.id })
          .eq("coordinator_name", name);
        if (linkError) throw linkError;
      }
    },
    onSuccess: () => {
      toast.success("Usuario creado");
      void queryClient.invalidateQueries({ queryKey: ["coaches-people"] });
      void queryClient.invalidateQueries({ queryKey: ["profiles"] });
      void queryClient.invalidateQueries({ queryKey: ["coaches"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function personRow(name: string, role: "coordinador" | "senior", link: boolean) {
    const key = `${role}:${name}`;
    return (
      <div key={key} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
        <span className="text-sm font-medium">{name}</span>
        <Input
          placeholder="correo@english4kids.com"
          value={emails[key] ?? ""}
          onChange={(e) => setEmails((prev) => ({ ...prev, [key]: e.target.value }))}
        />
        <Button
          variant="outline"
          disabled={createUser.isPending || !(emails[key] ?? "").trim()}
          onClick={() => createUser.mutate({ name, role, link })}
        >
          {link ? "Crear usuario y vincular" : "Crear usuario"}
        </Button>
      </div>
    );
  }

  return (
    <>
      <section className="mt-8 rounded-xl border bg-card p-5 shadow-panel">
        <h2 className="mb-4 text-sm font-semibold">Coordinadores sin usuario</h2>
        {pendingCoordinators.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todos los coordinadores tienen usuario.</p>
        ) : (
          <div className="space-y-3">
            {pendingCoordinators.map((name) => personRow(name, "coordinador", true))}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-xl border bg-card p-5 shadow-panel">
        <h2 className="mb-4 text-sm font-semibold">Seniors</h2>
        {seniors.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin seniors registrados.</p>
        ) : (
          <div className="space-y-3">{seniors.map((name) => personRow(name, "senior", false))}</div>
        )}
      </section>
    </>
  );
}
