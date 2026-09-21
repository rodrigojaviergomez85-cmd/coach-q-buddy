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
