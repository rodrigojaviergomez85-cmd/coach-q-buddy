import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const roleEnum = z.enum(["admin", "senior", "coordinador", "coach", "qa"]);

const schema = z.object({
  redirectTo: z.string().url().optional(),
  rows: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        email: z.string().trim().email().max(255),
        role: roleEnum,
        team: z.string().trim().max(200).optional(),
        coordinator_email: z.string().trim().email().max(255).optional(),
      }),
    )
    .min(1)
    .max(500),
});

export type ImportUserStatus = "invited" | "exists" | "error";

export interface ImportUserResult {
  name: string;
  email: string;
  role: string;
  status: ImportUserStatus;
  message?: string;
}

export const importUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => schema.parse(input))
  .handler(async ({ data, context }): Promise<{ results: ImportUserResult[] }> => {
    const { data: me, error: meError } = await context.supabase
      .from("profiles")
      .select("role, active")
      .eq("id", context.userId)
      .maybeSingle();
    if (meError || !me || !me.active || (me.role !== "admin" && me.role !== "senior")) {
      throw new Error("No tienes permiso para importar usuarios.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const results: ImportUserResult[] = [];

    for (const row of data.rows) {
      const email = row.email.toLowerCase();
      try {
        let coordinatorId: string | null = null;
        if (row.coordinator_email) {
          const { data: coord } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .ilike("email", row.coordinator_email.toLowerCase())
            .maybeSingle();
          if (!coord) {
            results.push({ ...row, email, status: "error", message: `Coordinador no encontrado: ${row.coordinator_email}` });
            continue;
          }
          coordinatorId = coord.id;
        }

        const { data: existing } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .ilike("email", email)
          .maybeSingle();

        if (existing) {
          results.push({ ...row, email, status: "exists", message: "Ya existe" });
          continue;
        }

        const tempPassword = generateTempPassword();
        const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { name: row.name, full_name: row.name, role: row.role, team: row.team ?? null },
        });
        if (createError || !created?.user) {
          const msg = createError?.message ?? "No se pudo crear";
          results.push({
            ...row,
            email,
            status: /already|registered|exists/i.test(msg) ? "exists" : "error",
            message: /already|registered|exists/i.test(msg) ? "Email already exists" : msg,
          });
          continue;
        }
        const userId = created.user.id;

        const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
          {
            ...(userId ? { id: userId } : {}),
            email,
            full_name: row.name,
            role: row.role,
            active: true,
            ...(row.team ? { team: row.team } : {}),
          },
          { onConflict: "email" },
        );
        if (profileError) {
          results.push({ ...row, email, status: "error", message: profileError.message });
          continue;
        }

        if (row.role === "coach") {
          const { data: prof } = await supabaseAdmin.from("profiles").select("id").ilike("email", email).maybeSingle();
          if (coordinatorId && prof) {
            await supabaseAdmin
              .from("coach_assignments")
              .upsert({ coordinator_id: coordinatorId, coach_id: prof.id }, { onConflict: "coordinator_id,coach_id" });
          }
          const { data: existingCoach } = await supabaseAdmin.from("coaches").select("id").ilike("email", email).maybeSingle();
          const coachRow = {
            full_name: row.name,
            email,
            senior_name: row.team ?? null,
            ...(coordinatorId ? { coordinator_id: coordinatorId } : {}),
          };
          if (existingCoach) await supabaseAdmin.from("coaches").update(coachRow).eq("id", existingCoach.id);
          else await supabaseAdmin.from("coaches").insert({ ...coachRow, active: true });
        }

        results.push({
          ...row,
          email,
          status: inviteError ? "exists" : "invited",
          message: inviteError ? "Ya existe en el acceso, perfil actualizado" : "Invitación enviada",
        });
      } catch (error) {
        results.push({
          ...row,
          email,
          status: "error",
          message: error instanceof Error ? error.message : "Error desconocido",
        });
      }
    }

    return { results };
  });
