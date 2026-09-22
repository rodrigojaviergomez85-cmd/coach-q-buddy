import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  autoFlagResult,
  autoItemResult,
  autoRuleResult,
  matchAutoRule,
  type BettyAutoConfig,
  type BettyDeterministic,
} from "./betty-metrics";
import { computeBettyScore, type BettyScoring, type ReviewResult } from "./betty-review";
import { phraseFor, round2, type PhraseRule } from "./scoring";
import { parseTranscript } from "./transcript";

const SYSTEM_PROMPT = `You are Coach Betty Well, a quality analyst for English4Kids/English4Adults online classes.
You receive a Zoom class transcript, deterministic metrics already computed, the class level and LOB,
and a list of rubric items with instructions. For EACH item return: result (si | parcial | no | nd),
score (0 to the item's max points, using halves), confidence (alta | media | baja), and 1-3 evidence
quotes copied VERBATIM from the transcript with their [mm:ss]. Never invent quotes. If the transcript
cannot show it (camera, body language, Prezi, slides, smiles), return result "nd", confidence "baja",
and say so in one short sentence. Transcripts garble children's speech: be tolerant with student
mistakes and judge the coach's behavior, not the transcription quality.
Also return: 3 kudos and 3 AOIs (Spanish, one sentence each, with a [mm:ss] reference), a 2-sentence
summary in Spanish, and up to 4 "watch minutes" (mm:ss ranges) where the coordinator should look at the video.
Judge only what a transcript can show. If the item requires seeing video (camera, smile, body language,
energy, Prezi, slides, lighting, background, WOF displayed, chat, reactions, report cards, Inet), return nd.
Respond ONLY with JSON matching the given schema.`;

const MAX_CHARS = 120_000;

function mmss(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Compacta el transcript a líneas "[mm:ss] Speaker: texto", agrupando turnos consecutivos. */
export function compactTranscript(raw: string): string {
  const segments = parseTranscript(raw);
  if (segments.length === 0) return raw.slice(0, MAX_CHARS);
  const start = Math.min(...segments.map((s) => s.start));
  const lines: Array<{ at: number; speaker: string; text: string; words: number }> = [];
  for (const seg of segments) {
    const last = lines[lines.length - 1];
    if (last && last.speaker === seg.speaker) {
      last.text = `${last.text} ${seg.text}`.trim();
      last.words = last.text.split(/\s+/).filter(Boolean).length;
      continue;
    }
    lines.push({
      at: seg.start - start,
      speaker: seg.speaker,
      text: seg.text,
      words: seg.text.split(/\s+/).filter(Boolean).length,
    });
  }
  const render = (list: typeof lines) =>
    list.map((l) => `[${mmss(l.at)}] ${l.speaker}: ${l.text}`).join("\n");
  let out = render(lines);
  if (out.length > MAX_CHARS) out = render(lines.filter((l) => l.words >= 3));
  return out.slice(0, MAX_CHARS);
}

interface AiItem {
  item_id: string;
  result: "si" | "parcial" | "no" | "nd";
  score?: number;
  confidence?: "alta" | "media" | "baja";
  evidence?: Array<{ m?: string; quote?: string; speaker?: string }>;
  note?: string;
}

interface AiOutput {
  items?: AiItem[];
  penalties?: AiItem[];
  bonus?: AiItem[];
  kudos?: string[];
  aois?: string[];
  summary?: string;
  watch_minutes?: Array<{ from?: string; to?: string; why?: string }>;
}

const tool = {
  type: "function",
  function: {
    name: "betty_report",
    description: "Análisis de la clase por ítem de rúbrica.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        items: { type: "array", items: itemSchema() },
        penalties: { type: "array", items: itemSchema() },
        bonus: { type: "array", items: itemSchema() },
        kudos: { type: "array", items: { type: "string" } },
        aois: { type: "array", items: { type: "string" } },
        summary: { type: "string" },
        watch_minutes: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: { from: { type: "string" }, to: { type: "string" }, why: { type: "string" } },
            required: ["from", "to", "why"],
          },
        },
      },
      required: ["items", "penalties", "bonus", "kudos", "aois", "summary", "watch_minutes"],
    },
  },
} as const;

function itemSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      item_id: { type: "string" },
      result: { type: "string", enum: ["si", "parcial", "no", "nd"] },
      score: { type: "number" },
      confidence: { type: "string", enum: ["alta", "media", "baja"] },
      evidence: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: { m: { type: "string" }, quote: { type: "string" }, speaker: { type: "string" } },
          required: ["m", "quote", "speaker"],
        },
      },
      note: { type: "string" },
    },
    required: ["item_id", "result", "score", "confidence", "evidence", "note"],
  } as const;
}

export const analyzeBettyScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ scan_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;

    const { data: scan, error: scanError } = await supabase
      .from("betty_scans")
      .select("*")
      .eq("id", data.scan_id)
      .maybeSingle();
    if (scanError || !scan) throw new Error("No encontré este análisis.");

    const { data: template } = await supabase
      .from("templates")
      .select("id, scoring, has_student_grid")
      .eq("id", scan.template_id)
      .maybeSingle();

    const { data: items } = await supabase
      .from("template_items")
      .select("id, kind, section, area, item_number, short_label, description, points, area_points, ai_mode, ai_instructions, sort_order")
      .eq("template_id", scan.template_id)
      .order("sort_order");

    const { data: configRows } = await supabase.from("app_config").select("key, value");
    const cfg: Record<string, unknown> = {};
    for (const row of configRows ?? []) cfg[row.key] = row.value;
    const num = (key: string, fallback: number) => {
      const n = Number(cfg[key]);
      return Number.isFinite(n) ? n : fallback;
    };
    const autoConfig: BettyAutoConfig = {
      talk_time_target_kids: num("talk_time_target_kids", 50),
      talk_time_target_teens: num("talk_time_target_teens", 60),
      talk_time_target_adults: num("talk_time_target_adults", 60),
      student_min_pct: num("student_min_pct", 8),
    };
    const model = typeof cfg["betty_model"] === "string" ? (cfg["betty_model"] as string) : "google/gemini-2.5-flash";
    const phrases = (Array.isArray(cfg["score_phrases"]) ? cfg["score_phrases"] : []) as PhraseRule[];

    const det = (scan.deterministic ?? {}) as unknown as BettyDeterministic;
    // En plantillas con tabla de estudiantes (Friday, Monthly) Betty solo evalúa el checklist.
    const all = (items ?? []).filter((i) => !(template?.has_student_grid && i.kind === "item"));
    // Si la plantilla nunca fue calibrada, Betty usa el modo genérico con la descripción.
    const calibrated = all.some((i) => i.ai_mode && i.ai_mode !== "manual");
    const isManual = (mode: string | null) => calibrated && (mode ?? "manual") === "manual";

    // 1. Ítems automáticos (sin IA)
    type Row = {
      item_id: string;
      ai_result: "si" | "parcial" | "no" | "nd";
      ai_score: number | null;
      ai_confidence: "alta" | "media" | "baja";
      ai_evidence: unknown[];
      ai_note: string | null;
      final_result: "si" | "no" | "na" | null;
      final_score: number | null;
    };
    const rows = new Map<string, Row>();

    for (const item of all) {
      if (isManual(item.ai_mode)) continue;
      let auto =
        item.ai_mode === "auto"
          ? item.kind === "item" || item.kind === "checklist"
            ? autoItemResult(item.item_number ?? "", det, { level: scan.level, lob: scan.lob, config: autoConfig })
            : autoFlagResult(item.description ?? "", det, { level: scan.level })
          : null;
      if (!auto && item.kind !== "item" && item.kind !== "checklist") {
        auto = autoFlagResult(item.description ?? "", det, { level: scan.level });
      }
      if (!auto) {
        const rule = matchAutoRule(item.description ?? "");
        if (rule) {
          auto = autoRuleResult(rule, det, {
            level: scan.level,
            lob: scan.lob,
            config: autoConfig,
            kind: item.kind,
          });
        }
      }
      if (!auto) continue;
      const maxPoints = Number(item.points ?? 0);
      const score = item.kind === "item" ? round2(maxPoints * auto.ratio) : null;
      rows.set(item.id, {
        item_id: item.id,
        ai_result: auto.result === "na" ? "nd" : auto.result,
        ai_score: score,
        ai_confidence: "alta",
        ai_evidence: [],
        ai_note: auto.note,
        final_result: auto.result === "na" ? "na" : auto.result === "no" ? "no" : "si",
        final_score: score,
      });
    }

    // 2. Ítems sugeridos (IA)
    const suggest = all.filter((i) => !rows.has(i.id) && !isManual(i.ai_mode));
    let aiOutput: AiOutput | null = null;
    let tokensIn = 0;
    let tokensOut = 0;
    let aiError: string | null = null;

    if (suggest.length > 0) {
      const apiKey = process.env["LOVABLE_API_KEY"];
      if (!apiKey) {
        aiError = "IA no disponible";
      } else {
        const payload = {
          level: scan.level,
          lob: scan.lob,
          deterministic: det,
          items: suggest.map((i) => ({
            item_id: i.id,
            kind: i.kind,
            code: i.item_number ?? i.short_label ?? "",
            max_points: Number(i.points ?? 0),
            description: i.description,
            instructions: i.ai_instructions ?? i.description ?? "",
          })),
        };
        try {
          const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                {
                  role: "user",
                  content: `RUBRIC AND METRICS:\n${JSON.stringify(payload)}\n\nTRANSCRIPT:\n${compactTranscript(scan.transcript_raw ?? "")}`,
                },
              ],
              tools: [tool],
              tool_choice: { type: "function", function: { name: "betty_report" } },
            }),
          });
          if (response.status === 429) throw new Error("Betty está ocupada, intenta en un minuto");
          if (response.status === 402) throw new Error("Sin créditos de IA; avisa al admin");
          if (!response.ok) throw new Error("IA no disponible");
          const json = (await response.json()) as {
            choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }>; content?: string } }>;
            usage?: { prompt_tokens?: number; completion_tokens?: number };
          };
          tokensIn = json.usage?.prompt_tokens ?? 0;
          tokensOut = json.usage?.completion_tokens ?? 0;
          const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ?? json.choices?.[0]?.message?.content;
          aiOutput = args ? (JSON.parse(args) as AiOutput) : null;
        } catch (error) {
          const message = error instanceof Error ? error.message : "IA no disponible";
          if (message.includes("ocupada") || message.includes("créditos")) throw new Error(message);
          aiError = "IA no disponible";
        }
      }
    }

    const byId = new Map(all.map((i) => [i.id, i]));
    const applyAi = (list: AiItem[] | undefined) => {
      for (const entry of list ?? []) {
        const item = byId.get(entry.item_id);
        if (!item || rows.has(item.id) || isManual(item.ai_mode)) continue;
        const maxPoints = Number(item.points ?? 0);
        const score =
          item.kind === "item"
            ? round2(Math.min(maxPoints, Math.max(0, Number(entry.score ?? (entry.result === "si" ? maxPoints : entry.result === "parcial" ? maxPoints / 2 : 0)))))
            : null;
        rows.set(item.id, {
          item_id: item.id,
          ai_result: entry.result,
          ai_score: score,
          ai_confidence: entry.confidence ?? "media",
          ai_evidence: entry.evidence ?? [],
          ai_note: entry.note ?? null,
          final_result: entry.result === "no" ? "no" : entry.result === "nd" ? null : "si",
          final_score: score,
        });
      }
    };
    applyAi(aiOutput?.items);
    applyAi(aiOutput?.penalties);
    applyAi(aiOutput?.bonus);

    // 3. Resto: manual o IA no disponible
    for (const item of all) {
      if (rows.has(item.id)) continue;
      rows.set(item.id, {
        item_id: item.id,
        ai_result: "nd",
        ai_score: null,
        ai_confidence: "baja",
        ai_evidence: [],
        ai_note: isManual(item.ai_mode) ? "Requiere revisión manual" : "IA no disponible",
        final_result: null,
        final_score: null,
      });
    }

    const resultOf = (id: string): ReviewResult => {
      const r = rows.get(id)?.ai_result;
      if (r === "si" || r === "parcial" || r === "no") return r;
      return "";
    };
    const bettyScore = round2(
      computeBettyScore(
        (template?.scoring ?? "points_sum") as BettyScoring,
        all.map((i) => ({
          kind: i.kind,
          points: i.points,
          area_points: i.area_points,
          area: i.area ?? i.section ?? "General",
          result: resultOf(i.id),
        })),
      ).total,
    );

    await supabase.from("betty_scan_answers").delete().eq("scan_id", scan.id);
    await supabase.from("betty_scan_answers").insert(
      [...rows.values()].map((r) => ({ ...r, scan_id: scan.id, ai_evidence: r.ai_evidence as never })),
    );

    const { error: updateError } = await supabase
      .from("betty_scans")
      .update({
        ai_output: (aiOutput ?? null) as never,
        ai_summary: aiOutput?.summary ?? (aiError ? "Betty no pudo usar la IA; solo métricas automáticas." : null),
        ai_kudos: (aiOutput?.kudos ?? []) as never,
        ai_aois: (aiOutput?.aois ?? []) as never,
        ai_watch_minutes: (aiOutput?.watch_minutes ?? []) as never,
        betty_score: bettyScore,
        betty_phrase: phraseFor(bettyScore, phrases),
        status: "analizado",
        model,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
      })
      .eq("id", scan.id);
    if (updateError) throw new Error("No se pudo guardar el análisis.");

    return { ok: true, betty_score: bettyScore, ai_error: aiError };
  });

export const getPublicBetty = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ token: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: scan, error } = await supabaseAdmin.rpc("get_betty_by_token", { _token: data.token });
    if (error) throw new Error("No se pudo abrir este análisis.");
    return (scan as unknown) ?? null;
  });
