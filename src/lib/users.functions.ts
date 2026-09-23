import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeName } from "@/lib/coach-import";

const schema = z.object({
  rows: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        role: z.literal("coach"),
        coordinator: z.string().trim().min(1).max(200),
      }),
    )
    .min(1)
    .max(2000),
});

export type ImportCoachStatus = "created" | "updated" | "error";

export interface ImportCoachResult {
  name: string;
  role: string;
  coordinator: string;
  status: ImportCoachStatus;
  message?: string;
}

export const importCoachesByName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => schema.parse(input))
  .handler(async ({ data, context }): Promise<{ results: ImportCoachResult[] }> => {
    const { data: me } = await context.supabase
      .from("profiles")
      .select("role, active")
      .eq("id", context.userId)
      .maybeSingle();
    if (!me || !me.active || (me.role !== "admin" && me.role !== "senior")) {
      throw new Error("No tienes permiso para importar coaches.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles, error: pErr } = await supabaseAdmin.from("profiles").select("id, full_name, role");
    if (pErr) throw new Error(pErr.message);
    const { data: coaches } = await supabaseAdmin.from("coaches").select("id, full_name");

    const coordByName = new Map<string, string>();
    const coachProfileByName = new Map<string, string>();
    for (const p of profiles ?? []) {
      const key = normalizeName(p.full_name);
      if (!key) continue;
      if (["coordinador", "coordinator", "senior", "admin"].includes(p.role)) coordByName.set(key, p.id);
      else if (p.role === "coach") coachProfileByName.set(key, p.id);
    }
    const coachRowByName = new Map<string, string>();
    for (const c of coaches ?? []) coachRowByName.set(normalizeName(c.full_name), c.id);

    const results: ImportCoachResult[] = [];
    for (const row of data.rows) {
      try {
        const coordinatorId = coordByName.get(normalizeName(row.coordinator));
        if (!coordinatorId) {
          results.push({ ...row, status: "error", message: `Coordinator not found: ${row.coordinator}` });
          continue;
        }
        const key = normalizeName(row.name);
        let coachId = coachProfileByName.get(key);
        const isNew = !coachId;
        if (coachId) {
          const { error } = await supabaseAdmin.from("profiles").update({ full_name: row.name, role: "coach", active: true }).eq("id", coachId);
          if (error) throw new Error(error.message);
        } else {
          const { data: created, error } = await supabaseAdmin
            .from("profiles")
            .insert({ full_name: row.name, role: "coach", active: true, email: null })
            .select("id")
            .single();
          if (error) throw new Error(error.message);
          coachId = created.id;
          coachProfileByName.set(key, coachId);
        }

        await supabaseAdmin.from("coach_assignments").delete().eq("coach_id", coachId).neq("coordinator_id", coordinatorId);
        const { error: aErr } = await supabaseAdmin
          .from("coach_assignments")
          .upsert({ coordinator_id: coordinatorId, coach_id: coachId }, { onConflict: "coordinator_id,coach_id" });
        if (aErr) throw new Error(aErr.message);

        // Mantener el catálogo de coaches sincronizado para que el coordinador vea al coach.
        const existingCoach = coachRowByName.get(key);
        const coachRow = { full_name: row.name, coordinator_id: coordinatorId, coordinator_name: row.coordinator };
        if (existingCoach) await supabaseAdmin.from("coaches").update(coachRow).eq("id", existingCoach);
        else {
          const { data: c } = await supabaseAdmin.from("coaches").insert({ ...coachRow, active: true }).select("id").single();
          if (c) coachRowByName.set(key, c.id);
        }

        results.push({ ...row, status: isNew ? "created" : "updated", message: isNew ? "Created" : "Updated" });
      } catch (error) {
        results.push({ ...row, status: "error", message: error instanceof Error ? error.message : "Error desconocido" });
      }
    }
    return { results };
  });
