/**
 * Métricas deterministas de Coach Betty Well.
 * Funciones puras: sin red, sin IA, sin fechas del sistema.
 */

import { speakerKey, type Metrics, type Segment, type SpeakerRole } from "./transcript";

export interface Quote {
  m: string;
  quote: string;
  speaker?: string;
}

export interface BettyDeterministic {
  duration_min: number;
  coach_spanish_pct: number;
  spanish_examples: Quote[];
  affirmations: { count: number; minutes: string[]; quotes: Quote[] };
  boosters: { count: number; minutes: string[] };
  rapport_end_min: number | null;
  follow_up_questions: number;
  break: { start: number | null; end: number | null; duration_min: number };
  af_window: { start: number; end: number };
  af_students: Array<{ name: string; turns: number }>;
  dead_air: Array<{ min: number; duration_min: number }>;
  started_on_time: boolean;
  students_pct: number;
  top3_students_pct: number;
  students_below_min: string[];
  expansion: {
    count: number;
    students: number;
    quotes: Quote[];
    coach_push_count: number;
  };
  avg_words_per_student_turn: number;
}

const SPANISH_WORDS = [
  "el", "la", "los", "las", "que", "porque", "para", "vamos", "tenemos", "entonces", "ustedes",
  "recuerden", "cuando", "como", "con", "esta", "están", "también", "pero", "hablamos", "decimos",
  "podemos", "nada", "todos", "dónde", "estaban", "aquí", "ahora", "bueno", "muy", "clase",
  "mañana", "de", "un", "una", "es", "ya", "eso", "esto", "qué",
];

const AFFIRMATIONS = [
  "super champion", "i am a champion", "i pay attention", "i love english", "i believe in myself",
  "i can do it", "never give up", "you can do it", "i love to study", "i learned a lot",
  "speak with fluency", "my coach is the best",
];

const BOOSTERS = [
  "stand up", "hot potato", "someone says", "simon says", "show me something", "happy face",
  "scream", "wake up", "stretch",
];

const RAPPORT_END = ["let's start", "lets start", "first activity", "let's begin", "lets begin", "let's get started", "lets get started"];

const CONNECTORS = ["because", "so ", "but ", "when ", "i think", "in my opinion", "for example", "since ", "although"];

const FOLLOW_UP_PATTERNS = [
  "why",
  "what did you",
  "where did",
  "when did",
  "how was",
  "do you like",
  "what about",
  "what is your favorite",
  "tell me",
  "and you?",
];

const PUSHES = ["why", "tell me more", "what else", "how come", "and then", "what about", "because?"];

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function mmss(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function norm(text: string): string {
  return ` ${text.toLowerCase().replace(/\s+/g, " ").trim()} `;
}

function words(text: string): string[] {
  const clean = text.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, " ");
  return clean.split(/\s+/).filter(Boolean);
}

export function isSpanishSegment(text: string): boolean {
  const list = words(text);
  const hits = new Set<string>();
  for (const w of list) if (SPANISH_WORDS.includes(w)) hits.add(w);
  return hits.size >= 2;
}

interface Ctx {
  segments: Segment[];
  roleOf: (speaker: string) => string;
  start: number;
  end: number;
}

function buildCtx(segments: Segment[], roles: SpeakerRole[]): Ctx {
  const byKey = new Map(roles.map((r) => [r.key, r.role] as const));
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const start = sorted.length > 0 ? Math.min(...sorted.map((s) => s.start)) : 0;
  const end = sorted.length > 0 ? Math.max(...sorted.map((s) => s.end)) : 0;
  return {
    segments: sorted,
    roleOf: (speaker: string) => byKey.get(speakerKey(speaker)) ?? "alumno",
    start,
    end,
  };
}

/** Huecos sin habla >= minGap segundos. Devuelve [inicio, fin] relativos al inicio de clase. */
function gaps(ctx: Ctx, minGap: number): Array<{ from: number; to: number }> {
  const out: Array<{ from: number; to: number }> = [];
  let cursor = ctx.start;
  for (const seg of ctx.segments) {
    if (seg.start - cursor >= minGap) out.push({ from: cursor - ctx.start, to: seg.start - ctx.start });
    cursor = Math.max(cursor, seg.end);
  }
  return out;
}

export function computeDeterministic(
  segments: Segment[],
  roles: SpeakerRole[],
  metrics: Metrics,
): BettyDeterministic {
  const ctx = buildCtx(segments, roles);
  const rel = (t: number) => t - ctx.start;
  const duration = Math.max(0, ctx.end - ctx.start);

  const coachSegs = ctx.segments.filter((s) => ctx.roleOf(s.speaker) === "coach");
  const studentSegs = ctx.segments.filter((s) => ctx.roleOf(s.speaker) === "alumno");

  // Español del coach
  let coachSec = 0;
  let spanishSec = 0;
  const spanishExamples: Quote[] = [];
  for (const seg of coachSegs) {
    const dur = Math.max(0, seg.end - seg.start);
    coachSec += dur;
    if (isSpanishSegment(seg.text)) {
      spanishSec += dur;
      if (spanishExamples.length < 6) {
        spanishExamples.push({ m: mmss(rel(seg.start)), quote: seg.text, speaker: seg.speaker });
      }
    }
  }

  // Afirmaciones y boosters
  const affQuotes: Quote[] = [];
  const affMinutes: string[] = [];
  const boosterMinutes: string[] = [];
  let boosterCount = 0;
  for (const seg of coachSegs) {
    const t = norm(seg.text);
    if (AFFIRMATIONS.some((a) => t.includes(a))) {
      affMinutes.push(mmss(rel(seg.start)));
      affQuotes.push({ m: mmss(rel(seg.start)), quote: seg.text, speaker: seg.speaker });
    }
    if (BOOSTERS.some((b) => t.includes(b))) {
      boosterCount += 1;
      boosterMinutes.push(mmss(rel(seg.start)));
    }
  }

  // Rapport
  let rapportEnd: number | null = null;
  for (const seg of coachSegs) {
    const t = norm(seg.text);
    if (RAPPORT_END.some((p) => t.includes(p))) {
      rapportEnd = round1(rel(seg.start) / 60);
      break;
    }
  }

  // AF window
  let afStart: number | null = null;
  for (const seg of coachSegs) {
    const t = norm(seg.text);
    if (t.includes("automatic fluency") || t.includes(" af ")) {
      afStart = rel(seg.start);
      break;
    }
  }
  const afWindow = {
    start: afStart ?? Math.max(0, duration - 20 * 60),
    end: duration,
  };

  // Break
  const bigGaps = gaps(ctx, 90);
  let breakStart: number | null = null;
  for (const seg of coachSegs) {
    if (!norm(seg.text).includes("break")) continue;
    const segEnd = rel(seg.end);
    const gap = bigGaps.find((g) => g.from >= segEnd - 5 && g.from <= segEnd + 60);
    if (gap) {
      breakStart = rel(seg.start);
      break;
    }
  }
  let breakEnd: number | null = null;
  if (breakStart !== null) {
    const next = coachSegs.find((s) => rel(s.start) > breakStart! + 60);
    breakEnd = next ? rel(next.start) : null;
  }

  // AF students
  const afMap = new Map<string, { name: string; turns: number }>();
  for (const seg of studentSegs) {
    const at = rel(seg.start);
    if (at < afWindow.start || at > afWindow.end) continue;
    if (words(seg.text).length < 5) continue;
    const key = speakerKey(seg.speaker);
    const current = afMap.get(key) ?? { name: seg.speaker, turns: 0 };
    current.turns += 1;
    afMap.set(key, current);
  }

  // Dead air (fuera del break)
  const deadAir = gaps(ctx, 120)
    .filter((g) => {
      if (breakStart === null) return true;
      const bEnd = breakEnd ?? breakStart + 300;
      return g.to <= breakStart || g.from >= bEnd;
    })
    .map((g) => ({ min: round1(g.from / 60), duration_min: round1((g.to - g.from) / 60) }));

  const startedOnTime = ctx.segments.length > 0 && rel(ctx.segments[0]!.start) <= 180;

  // Follow-up questions del coach fuera de AF (patrón en cualquier posición)
  let followUps = 0;
  for (const seg of coachSegs) {
    if (rel(seg.start) >= afWindow.start) continue;
    for (const sentence of seg.text.split(/(?<=[.?!])/)) {
      const t = sentence.toLowerCase().trim();
      if (!t) continue;
      if (FOLLOW_UP_PATTERNS.some((p) => t.includes(p))) followUps += 1;
    }
  }

  // Expansión
  const expansionQuotes: Quote[] = [];
  const expansionStudents = new Set<string>();
  let expansionCount = 0;
  for (const seg of studentSegs) {
    const wordCount = words(seg.text).length;
    if (wordCount < 10) continue;
    const t = norm(seg.text);
    if (!CONNECTORS.some((c) => t.includes(c))) continue;
    expansionCount += 1;
    expansionStudents.add(speakerKey(seg.speaker));
    if (expansionQuotes.length < 6) {
      expansionQuotes.push({ m: mmss(rel(seg.start)), quote: seg.text, speaker: seg.speaker });
    }
  }
  let pushCount = 0;
  for (const seg of coachSegs) {
    const t = norm(seg.text);
    if (PUSHES.some((p) => t.includes(p))) pushCount += 1;
  }

  const studentWords = studentSegs.reduce((sum, s) => sum + words(s.text).length, 0);

  return {
    duration_min: round1(duration / 60),
    coach_spanish_pct: coachSec > 0 ? round1((spanishSec / coachSec) * 100) : 0,
    spanish_examples: spanishExamples,
    affirmations: { count: affQuotes.length, minutes: affMinutes, quotes: affQuotes.slice(0, 6) },
    boosters: { count: boosterCount, minutes: boosterMinutes },
    rapport_end_min: rapportEnd,
    follow_up_questions: followUps,
    break: {
      start: breakStart,
      end: breakEnd,
      duration_min: breakStart !== null && breakEnd !== null ? round1((breakEnd - breakStart) / 60) : 0,
    },
    af_window: afWindow,
    af_students: [...afMap.values()].sort((a, b) => b.turns - a.turns),
    dead_air: deadAir,
    started_on_time: startedOnTime,
    students_pct: metrics.students_pct,
    top3_students_pct: metrics.top3_students_pct,
    students_below_min: metrics.students_below_min,
    expansion: {
      count: expansionCount,
      students: expansionStudents.size,
      quotes: expansionQuotes,
      coach_push_count: pushCount,
    },
    avg_words_per_student_turn: studentSegs.length > 0 ? round1(studentWords / studentSegs.length) : 0,
  };
}

export interface BettyAutoConfig {
  talk_time_target_kids: number;
  talk_time_target_teens: number;
  talk_time_target_adults: number;
  student_min_pct: number;
}

export interface AutoResult {
  result: "si" | "parcial" | "no" | "na";
  ratio: number; // 0, 0.25/0.5, 1 → fracción de los puntos del ítem
  note: string;
}

export function talkTimeTarget(lob: string | null | undefined, config: BettyAutoConfig): number {
  const l = (lob ?? "").toLowerCase();
  if (l.includes("teen")) return config.talk_time_target_teens;
  if (l.includes("adult")) return config.talk_time_target_adults;
  return config.talk_time_target_kids;
}

export function levelNumber(level: string | null | undefined): number | null {
  const m = String(level ?? "").match(/\d+/);
  return m ? Number(m[0]) : null;
}

function grade(hits: number, total: number, note: string): AutoResult {
  if (hits >= total) return { result: "si", ratio: 1, note };
  if (hits > 0) return { result: "parcial", ratio: 0.5, note };
  return { result: "no", ratio: 0, note };
}

/** Resultados automáticos por número de ítem (P1, P2, P4, P5, M2, E2). */
export function autoItemResult(
  itemNumber: string,
  det: BettyDeterministic,
  opts: { level?: string | null; lob?: string | null; config: BettyAutoConfig },
): AutoResult | null {
  const cfg = opts.config;
  switch (itemNumber) {
    case "P1": {
      const target = talkTimeTarget(opts.lob, cfg);
      const note = `Alumnos ${det.students_pct} % (meta ${target} %).`;
      if (det.students_pct >= target) return { result: "si", ratio: 1, note };
      if (det.students_pct >= target - 10) return { result: "parcial", ratio: 0.5, note };
      return { result: "no", ratio: 0, note };
    }
    case "P2": {
      const noneBelow = det.students_below_min.length === 0;
      const topOk = det.top3_students_pct <= 60;
      const hits = (noneBelow ? 1 : 0) + (topOk ? 1 : 0);
      return grade(
        hits,
        2,
        `Top 3: ${det.top3_students_pct} % · ${det.students_below_min.length} alumnos bajo el mínimo (${cfg.student_min_pct} %).`,
      );
    }
    case "P4": {
      const breakMin = det.break.duration_min;
      const afMin = (det.af_window.end - det.af_window.start) / 60;
      const checks = [
        det.started_on_time,
        det.rapport_end_min !== null && det.rapport_end_min <= 5,
        breakMin >= 3 && breakMin <= 5,
        afMin >= 12,
        det.dead_air.every((d) => d.duration_min <= 2),
      ];
      const missing = checks.filter((c) => !c).length;
      const note = `Inicio puntual: ${det.started_on_time ? "sí" : "no"} · rapport: ${det.rapport_end_min ?? "—"} min · break: ${breakMin} min · AF: ${Math.round(afMin)} min · tiempos muertos: ${det.dead_air.length}.`;
      if (missing === 0) return { result: "si", ratio: 1, note };
      if (missing === 1) return { result: "parcial", ratio: 0.5, note };
      return { result: "no", ratio: 0, note };
    }
    case "P5": {
      const lvl = levelNumber(opts.level);
      if (lvl !== null && lvl < 5) {
        return { result: "na", ratio: 0, note: `Nivel ${lvl}: no aplica.` };
      }
      const expandOk = det.expansion.students >= 3;
      const pushOk = det.expansion.coach_push_count >= 5;
      const hits = (expandOk ? 1 : 0) + (pushOk ? 1 : 0);
      return grade(
        hits,
        2,
        `${det.expansion.students} alumnos con expansión · ${det.expansion.coach_push_count} empujes del coach.`,
      );
    }
    case "M2": {
      const n = det.affirmations.count;
      const note = `${n} afirmaciones detectadas.`;
      if (n >= 5) return { result: "si", ratio: 1, note };
      if (n >= 3) return { result: "parcial", ratio: 0.5, note };
      return { result: "no", ratio: 0, note };
    }
    case "E2": {
      const rapportOk = det.rapport_end_min !== null && det.rapport_end_min <= 5;
      const questionsOk = det.follow_up_questions >= 2;
      const hits = (rapportOk ? 1 : 0) + (questionsOk ? 1 : 0);
      return grade(
        hits,
        2,
        `Rapport termina en ${det.rapport_end_min ?? "—"} min · ${det.follow_up_questions} preguntas de seguimiento.`,
      );
    }
    default:
      return null;
  }
}

/** Penalidades y bonus automáticos a partir de la descripción del ítem. */
export function autoFlagResult(
  description: string,
  det: BettyDeterministic,
  opts: { level?: string | null },
): AutoResult | null {
  const d = description.toLowerCase();
  if (d.includes("too much spanish")) {
    const lvl = levelNumber(opts.level) ?? 0;
    const limit = lvl <= 2 ? 20 : 10;
    const over = det.coach_spanish_pct > limit;
    return {
      result: over ? "si" : "no",
      ratio: over ? 1 : 0,
      note: `Español del coach: ${det.coach_spanish_pct} % (límite ${limit} %).`,
    };
  }
  if (d.includes("timing")) {
    const few = det.af_students.length < 3;
    return {
      result: few ? "si" : "no",
      ratio: few ? 1 : 0,
      note: `${det.af_students.length} alumnos hablaron en AF.`,
    };
  }
  if (d.includes("80/20")) {
    const ok = det.students_pct >= 70;
    return { result: ok ? "si" : "no", ratio: ok ? 1 : 0, note: `Alumnos ${det.students_pct} %.` };
  }
  return null;
}

/** Hash estable del transcript (sin red, sin crypto async). */
export function transcriptHash(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 + c + i, 2246822519) >>> 0;
  }
  return `${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`;
}

// ============================================================
// Reglas automáticas por palabras clave en la descripción del ítem
// ============================================================

export type AutoRuleId =
  | "p1"
  | "p2"
  | "m2"
  | "spanish"
  | "af_students"
  | "e2"
  | "break"
  | "boosters"
  | "dead_air"
  | "p5";

export interface AutoRule {
  id: AutoRuleId;
  label: string;
  /** Número exigido por el ítem (alumnos en AF, boosters, etc.). */
  param?: number;
}

const RULE_LABELS: Record<AutoRuleId, string> = {
  p1: "Talking time de alumnos",
  p2: "Participación equilibrada",
  m2: "Afirmaciones",
  spanish: "Ambiente en inglés",
  af_students: "Alumnos evaluados en AF",
  e2: "Rapport en los primeros minutos",
  break: "Break respetado",
  boosters: "Boosters",
  dead_air: "Ritmo sin tiempos muertos",
  p5: "Expansión / pensamiento crítico",
};

function flat(text: string): string {
  return ` ${String(text ?? "")
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[^\p{L}\p{N}%/.-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

/**
 * Detecta si la descripción de un ítem se puede resolver con las métricas
 * deterministas en lugar de la IA.
 */
export function matchAutoRule(description: string): AutoRule | null {
  const raw = String(description ?? "");
  const d = flat(raw);
  const rule = (id: AutoRuleId, param?: number): AutoRule => ({
    id,
    label: RULE_LABELS[id],
    ...(param === undefined ? {} : { param }),
  });

  // Ambiente en inglés / español del coach
  if (
    d.includes("english environment") ||
    d.includes("english-speaking environment") ||
    d.includes("in english 90") ||
    d.includes("too much spanish")
  ) {
    return rule("spanish");
  }

  // Alumnos evaluados en AF
  const afCount = /\b(three|3)\s+(or more\s+)?(trainees|students)/.test(d)
    ? 3
    : /\b(two|2)\s+(or more\s+)?(trainees|students)/.test(d)
      ? 2
      : null;
  const afContext =
    d.includes("evaluated in af") ||
    d.includes("trainees during automatic fluency") ||
    d.includes("automatic fluency") ||
    / af[ :]/.test(d);
  if (afCount !== null && afContext) return rule("af_students", afCount);
  if (d.includes("evaluated in af") || d.includes("trainees during automatic fluency")) {
    return rule("af_students", 3);
  }

  // Talking time de alumnos
  if (
    d.includes("student talk time") ||
    d.includes("student-centered") ||
    d.includes("student centered") ||
    d.includes("80/20") ||
    d.includes("70-80%") ||
    d.includes("70-80")
  ) {
    return rule("p1");
  }

  // Participación equilibrada
  if (
    d.includes("equal participation") ||
    d.includes("equalized participation") ||
    d.includes("everyone spoke") ||
    d.includes("no passive trainees")
  ) {
    return rule("p2");
  }

  if (d.includes("affirmations")) return rule("m2");

  // Rapport en los primeros minutos
  if (
    d.includes("first 5 minutes") ||
    d.includes("first 3-5 minutes") ||
    (d.includes("rapport") && d.includes("minute"))
  ) {
    return rule("e2");
  }

  if (d.includes("break time") || d.includes("respected break")) return rule("break");

  // Boosters con un número
  if (d.includes("booster")) {
    const wordNumbers: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
    let n: number | null = null;
    const word = d.match(/\b(one|two|three|four|five|six)\s+boosters?/);
    if (word) n = wordNumbers[word[1]!] ?? null;
    if (n === null) {
      const digits = d.match(/(\d+)\s*-\s*(\d+)/);
      if (digits) n = Number(digits[1]);
    }
    if (n === null) {
      const single = d.match(/(\d+)\s+boosters?/) ?? d.match(/boosters?[^\d]{0,12}(\d+)/);
      if (single) n = Number(single[1]);
    }
    if (n === null && d.includes("required number")) n = 2;
    if (n !== null && Number.isFinite(n)) return rule("boosters", n);
  }

  if (d.includes("dead air") || d.includes("fast-paced") || d.includes("fast paced")) {
    return rule("dead_air");
  }

  // Expansión / pensamiento crítico
  if (
    d.includes("shopping list") ||
    d.includes("shopping-list") ||
    d.includes("critical thinking") ||
    d.includes("expand") ||
    /\bBET\b/.test(raw) ||
    /\bWELL\b/.test(raw)
  ) {
    return rule("p5");
  }

  return null;
}

/** Resuelve una regla automática contra las métricas deterministas. */
export function autoRuleResult(
  rule: AutoRule,
  det: BettyDeterministic,
  opts: { level?: string | null; lob?: string | null; config: BettyAutoConfig; kind?: string | null },
): AutoResult | null {
  switch (rule.id) {
    case "p1":
      return autoItemResult("P1", det, opts);
    case "p2":
      return autoItemResult("P2", det, opts);
    case "m2":
      return autoItemResult("M2", det, opts);
    case "e2":
      return autoItemResult("E2", det, opts);
    case "p5":
      return autoItemResult("P5", det, opts);
    case "spanish": {
      const pct = det.coach_spanish_pct;
      const note = `Español del coach ${pct} % (meta ≤ 10 %).`;
      const good: AutoResult =
        pct <= 10
          ? { result: "si", ratio: 1, note }
          : pct <= 20
            ? { result: "parcial", ratio: 0.5, note }
            : { result: "no", ratio: 0, note };
      if (opts.kind === "penalty") {
        const over = pct > 20;
        return { result: over ? "si" : "no", ratio: over ? 1 : 0, note };
      }
      return good;
    }
    case "af_students": {
      const target = rule.param ?? 3;
      const n = det.af_students.length;
      const note = `${n} alumnos hablaron en AF · meta ${target}.`;
      if (n >= target) return { result: "si", ratio: 1, note };
      if (n >= target - 1) return { result: "parcial", ratio: 0.5, note };
      return { result: "no", ratio: 0, note };
    }
    case "break": {
      const min = det.break.duration_min;
      const note = `Break de ${min} min (meta 3–5 min).`;
      if (min >= 3 && min <= 5) return { result: "si", ratio: 1, note };
      if (min > 0) return { result: "parcial", ratio: 0.5, note };
      return { result: "no", ratio: 0, note };
    }
    case "boosters": {
      const target = rule.param ?? 2;
      const n = det.boosters.count;
      const note = `${n} boosters · meta ${target}.`;
      if (n >= target) return { result: "si", ratio: 1, note };
      if (n >= Math.ceil(target / 2)) return { result: "parcial", ratio: 0.5, note };
      return { result: "no", ratio: 0, note };
    }
    case "dead_air": {
      const long = det.dead_air.filter((d) => d.duration_min > 2);
      const note = `${long.length} tiempos muertos de más de 2 min.`;
      if (long.length === 0) return { result: "si", ratio: 1, note };
      if (long.length === 1) return { result: "parcial", ratio: 0.5, note };
      return { result: "no", ratio: 0, note };
    }
    default:
      return null;
  }
}

export function autoRuleLabel(id: AutoRuleId): string {
  return RULE_LABELS[id];
}
