/**
 * Analizador de transcripts de Zoom para QA Coaches E4K.
 * Funciones puras: sin red, sin IA, sin fechas del sistema.
 */

export interface Segment {
  speaker: string;
  start: number;
  end: number;
  text: string;
}

export type SpeakerRoleKind = "coach" | "alumno" | "audio" | "ignorar";

export interface SpeakerRole {
  name: string;
  key: string;
  role: SpeakerRoleKind;
  sec: number;
  turns: number;
}

export interface TranscriptConfig {
  talk_time_green: number;
  talk_time_yellow: number;
  student_min_pct: number;
}

export interface SpeakerMetric {
  name: string;
  key: string;
  role: SpeakerRoleKind;
  sec: number;
  min: number;
  turns: number;
  words: number;
  pct_of_students: number;
}

export interface BlockMetric {
  block: number;
  coach_pct: number;
  students_pct: number;
}

export interface Metrics {
  duration_min: number;
  spoken_min: number;
  silence_min: number;
  audio_min: number;
  coach_sec: number;
  students_sec: number;
  coach_pct: number;
  students_pct: number;
  coach_words: number;
  students_words: number;
  speakers: SpeakerMetric[];
  top3_students_pct: number;
  students_below_min: string[];
  avg_student_turn_sec: number;
  blocks_10min: BlockMetric[];
  traffic_light: "verde" | "amarillo" | "rojo";
}

export const MAX_SEGMENT_SEC = 15;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Normaliza el nombre para agrupar (sin emojis, espacios extra, minúsculas). */
export function speakerKey(name: string): string {
  return name
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** "00:01:27.370" | "01:27" | "1:02:03" → segundos */
function parseTime(raw: string): number | null {
  const m = raw.trim().match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/);
  if (!m) return null;
  const h = m[1] ? Number(m[1]) : 0;
  const mm = Number(m[2]);
  const ss = Number(m[3]);
  const ms = m[4] ? Number(m[4].padEnd(3, "0")) / 1000 : 0;
  return h * 3600 + mm * 60 + ss + ms;
}

const TIME_ONLY = /^(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?$/;

function parseVtt(text: string): Segment[] {
  const segments: Segment[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const arrow = line.match(
      /^\s*((?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?)\s*-->\s*((?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?)/,
    );
    if (!arrow) continue;
    const start = parseTime(arrow[1]!);
    const end = parseTime(arrow[2]!);
    if (start === null || end === null) continue;

    const body: string[] = [];
    let j = i + 1;
    while (j < lines.length && (lines[j] ?? "").trim() !== "") {
      body.push((lines[j] ?? "").trim());
      j += 1;
    }
    i = j;
    const content = body.join(" ").trim();
    if (!content) continue;

    const sep = content.indexOf(": ");
    const speaker = sep > 0 ? content.slice(0, sep).trim() : "—";
    const spoken = sep > 0 ? content.slice(sep + 2).trim() : content;
    segments.push({ speaker, start, end: Math.max(end, start), text: spoken });
  }
  return segments;
}

function parsePanel(text: string): Segment[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "");

  type Raw = { speaker: string; start: number; text: string };
  const raws: Raw[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;

    // Caso "Nombre  00:01:27  texto" en una sola línea
    const inline = line.match(
      /^(.+?)\s+((?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?)\s*(.*)$/,
    );

    if (TIME_ONLY.test(line)) continue; // hora suelta sin nombre previo válido

    const next = lines[i + 1];
    if (next && TIME_ONLY.test(next)) {
      const start = parseTime(next);
      if (start !== null) {
        const bodyParts: string[] = [];
        let j = i + 2;
        while (j < lines.length) {
          const candidate = lines[j]!;
          if (TIME_ONLY.test(candidate)) break;
          const following = lines[j + 1];
          if (following && TIME_ONLY.test(following)) break;
          bodyParts.push(candidate);
          j += 1;
        }
        raws.push({ speaker: line, start, text: bodyParts.join(" ").trim() });
        i = j - 1;
        continue;
      }
    }

    if (inline && inline[3] && inline[3].trim() !== "") {
      const start = parseTime(inline[2]!);
      if (start !== null) {
        raws.push({
          speaker: inline[1]!.replace(/:$/, "").trim(),
          start,
          text: inline[3]!.trim(),
        });
      }
    }
  }

  return raws.map((raw, idx) => {
    const nextStart = raws[idx + 1]?.start;
    const end =
      nextStart === undefined
        ? raw.start + MAX_SEGMENT_SEC
        : Math.min(nextStart, raw.start + MAX_SEGMENT_SEC);
    return {
      speaker: raw.speaker,
      start: raw.start,
      end: Math.max(end, raw.start),
      text: raw.text,
    };
  });
}

export function parseTranscript(text: string): Segment[] {
  if (!text || !text.trim()) return [];
  if (text.includes("-->")) {
    const vtt = parseVtt(text);
    if (vtt.length > 0) return vtt;
  }
  return parsePanel(text);
}

export function classifySpeakers(segments: Segment[]): SpeakerRole[] {
  const map = new Map<string, SpeakerRole>();
  for (const seg of segments) {
    const key = speakerKey(seg.speaker);
    const existing = map.get(key);
    const dur = Math.max(0, seg.end - seg.start);
    if (existing) {
      existing.sec += dur;
      existing.turns += 1;
    } else {
      map.set(key, {
        name: seg.speaker,
        key,
        role: guessRole(seg.speaker),
        sec: dur,
        turns: 1,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.sec - a.sec);
}

function guessRole(name: string): SpeakerRoleKind {
  const clean = name.trim().toLowerCase();
  if (clean.startsWith("audio shared by")) return "audio";
  if (/(coach|coah|teacher|profe|miss|mr\.)/.test(clean)) return "coach";
  return "alumno";
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function computeMetrics(
  segments: Segment[],
  roles: SpeakerRole[],
  config: TranscriptConfig,
): Metrics {
  const roleByKey = new Map(roles.map((r) => [r.key, r.role] as const));
  const nameByKey = new Map(roles.map((r) => [r.key, r.name] as const));

  const empty: Metrics = {
    duration_min: 0,
    spoken_min: 0,
    silence_min: 0,
    audio_min: 0,
    coach_sec: 0,
    students_sec: 0,
    coach_pct: 0,
    students_pct: 0,
    coach_words: 0,
    students_words: 0,
    speakers: [],
    top3_students_pct: 0,
    students_below_min: [],
    avg_student_turn_sec: 0,
    blocks_10min: [],
    traffic_light: "rojo",
  };
  if (segments.length === 0) return empty;

  const start = Math.min(...segments.map((s) => s.start));
  const end = Math.max(...segments.map((s) => s.end));
  const durationSec = Math.max(0, end - start);

  let coachSec = 0;
  let studentsSec = 0;
  let audioSec = 0;
  let coachWords = 0;
  let studentsWords = 0;
  let studentTurns = 0;

  const perSpeaker = new Map<string, SpeakerMetric>();
  const blocks = new Map<number, { coach: number; students: number }>();

  for (const seg of segments) {
    const key = speakerKey(seg.speaker);
    const role = roleByKey.get(key) ?? guessRole(seg.speaker);
    if (role === "ignorar") continue;
    const dur = Math.max(0, seg.end - seg.start);
    const words = countWords(seg.text);

    if (role === "audio") {
      audioSec += dur;
    } else if (role === "coach") {
      coachSec += dur;
      coachWords += words;
    } else {
      studentsSec += dur;
      studentsWords += words;
      studentTurns += 1;
    }

    const entry = perSpeaker.get(key) ?? {
      name: nameByKey.get(key) ?? seg.speaker,
      key,
      role,
      sec: 0,
      min: 0,
      turns: 0,
      words: 0,
      pct_of_students: 0,
    };
    entry.sec += dur;
    entry.turns += 1;
    entry.words += words;
    perSpeaker.set(key, entry);

    if (role === "coach" || role === "alumno") {
      const blockIdx = Math.floor((seg.start - start) / 600);
      const block = blocks.get(blockIdx) ?? { coach: 0, students: 0 };
      if (role === "coach") block.coach += dur;
      else block.students += dur;
      blocks.set(blockIdx, block);
    }
  }

  const spokenSec = coachSec + studentsSec;
  const talkSec = coachSec + studentsSec;
  const coachPct = talkSec > 0 ? (coachSec / talkSec) * 100 : 0;
  const studentsPct = talkSec > 0 ? 100 - coachPct : 0;

  const speakers = Array.from(perSpeaker.values())
    .map((s) => ({
      ...s,
      min: round1(s.sec / 60),
      sec: round1(s.sec),
      pct_of_students:
        s.role === "alumno" && studentsSec > 0 ? round1((s.sec / studentsSec) * 100) : 0,
    }))
    .sort((a, b) => b.sec - a.sec);

  const students = speakers.filter((s) => s.role === "alumno");
  const top3 = round1(
    students.slice(0, 3).reduce((acc, s) => acc + s.pct_of_students, 0),
  );

  const blocks10 = Array.from(blocks.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([block, v]) => {
      const total = v.coach + v.students;
      return {
        block: block + 1,
        coach_pct: total > 0 ? round1((v.coach / total) * 100) : 0,
        students_pct: total > 0 ? round1(100 - (v.coach / total) * 100) : 0,
      };
    });

  const trafficLight: Metrics["traffic_light"] =
    studentsPct >= config.talk_time_green
      ? "verde"
      : studentsPct >= config.talk_time_yellow
        ? "amarillo"
        : "rojo";

  return {
    duration_min: round1(durationSec / 60),
    spoken_min: round1(spokenSec / 60),
    silence_min: round1(Math.max(0, durationSec - spokenSec - audioSec) / 60),
    audio_min: round1(audioSec / 60),
    coach_sec: round1(coachSec),
    students_sec: round1(studentsSec),
    coach_pct: round1(coachPct),
    students_pct: round1(studentsPct),
    coach_words: coachWords,
    students_words: studentsWords,
    speakers,
    top3_students_pct: top3,
    students_below_min: students
      .filter((s) => s.pct_of_students < config.student_min_pct)
      .map((s) => s.name),
    avg_student_turn_sec: studentTurns > 0 ? round1(studentsSec / studentTurns) : 0,
    blocks_10min: blocks10,
    traffic_light: trafficLight,
  };
}

/** Frases de lectura rápida, generadas por reglas (sin IA). */
export function quickRead(metrics: Metrics, config: TranscriptConfig): string[] {
  const out: string[] = [];
  if (metrics.coach_pct > 100 - config.talk_time_yellow) {
    out.push(
      `El coach habló ${metrics.coach_pct} % del tiempo; la meta es que los alumnos tengan al menos ${config.talk_time_green} %.`,
    );
  }
  if (metrics.top3_students_pct >= 70) {
    out.push(
      `3 alumnos concentran ${metrics.top3_students_pct} % del tiempo de alumnos; hay ${metrics.students_below_min.length} alumnos por debajo del mínimo.`,
    );
  }
  if (metrics.silence_min > 15) {
    out.push(
      `Hubo ${metrics.silence_min} min sin habla (esperas, micrófonos, copiar); revisar tiempos muertos.`,
    );
  }
  if (out.length === 0) out.push("Buen balance de participación.");
  return out;
}

export function metricsToCsv(metrics: Metrics): string {
  const header = "speaker,rol,minutos,turnos,palabras,% del tiempo de alumnos";
  const rows = metrics.speakers.map((s) =>
    [
      `"${s.name.replace(/"/g, '""')}"`,
      s.role,
      s.min,
      s.turns,
      s.words,
      s.pct_of_students,
    ].join(","),
  );
  return [header, ...rows].join("\n");
}

export function metricsToText(metrics: Metrics): string {
  const lines = [
    `Duración: ${metrics.duration_min} min`,
    `Coach: ${metrics.coach_pct} % · Alumnos: ${metrics.students_pct} % (${metrics.traffic_light})`,
    `Minutos de alumnos: ${round1(metrics.students_sec / 60)} min`,
    `Silencio: ${metrics.silence_min} min · Audio compartido: ${metrics.audio_min} min`,
    "",
    "Speaker | Rol | Min | Turnos | Palabras | % alumnos",
  ];
  for (const s of metrics.speakers) {
    lines.push(`${s.name} | ${s.role} | ${s.min} | ${s.turns} | ${s.words} | ${s.pct_of_students}`);
  }
  lines.push("", `Top 3 alumnos: ${metrics.top3_students_pct} % del tiempo de alumnos`);
  return lines.join("\n");
}
