import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ReportData } from "./monitoring";

export const getPublicReport = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ token: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: report, error } = await supabaseAdmin.rpc("get_report_by_token", { _token: data.token });
    if (error) throw new Error("No se pudo abrir este reporte.");
    return (report as unknown as ReportData | null) ?? null;
  });

export const submitCoachResponse = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    token: z.string().uuid(),
    summary: z.string().trim().min(1).max(2000),
    commitment: z.string().trim().min(1).max(2000),
    counter: z.string().trim().max(2000).optional(),
  }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: accepted, error } = await supabaseAdmin.rpc("submit_coach_response", {
      _token: data.token, _summary: data.summary, _commitment: data.commitment, ...(data.counter ? { _counter: data.counter } : {}),
    });
    if (error) throw new Error("No se pudo guardar tu respuesta.");
    if (!accepted) throw new Error("Esta respuesta ya fue enviada o el enlace ya no está disponible.");
    return { ok: true };
  });
