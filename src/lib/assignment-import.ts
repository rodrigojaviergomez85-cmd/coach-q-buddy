import { normalizeName } from "./coach-import";

export interface AssignmentRow {
  coach: string;
  coordinator: string;
  senior: string;
}

function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i += 1; } else q = false;
      } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === "," || ch === ";") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

export function parseAssignmentCsv(text: string): { rows: AssignmentRow[]; missingColumns: string[] } {
  const lines = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim());
  if (!lines.length) return { rows: [], missingColumns: [] };
  const h = splitLine(lines[0]!).map((x) => x.toLowerCase());
  const idx = { coach: h.indexOf("coach"), coordinator: h.indexOf("coordinator"), senior: h.indexOf("senior") };
  const missingColumns = (Object.keys(idx) as (keyof typeof idx)[]).filter((k) => idx[k] < 0);
  if (missingColumns.length) return { rows: [], missingColumns };
  const rows = lines.slice(1).map((l) => {
    const c = splitLine(l);
    return { coach: c[idx.coach] ?? "", coordinator: c[idx.coordinator] ?? "", senior: c[idx.senior] ?? "" };
  }).filter((r) => r.coach || r.coordinator || r.senior);
  return { rows, missingColumns };
}

/**
 * Busca un nombre en una lista. Primero coincidencia exacta (sin tildes/mayúsculas);
 * si no, acepta el único candidato cuyas palabras aparecen todas en el nombre del CSV
 * (p. ej. perfil "Aitza Trejo" ↔ CSV "AITZA OLIVIA TREJO CORNEJO").
 */
export function matchByName<T extends { id: string; name: string | null }>(name: string, list: T[]): T | null {
  const key = normalizeName(name);
  if (!key) return null;
  const exact = list.filter((p) => normalizeName(p.name) === key);
  if (exact.length === 1) return exact[0]!;
  if (exact.length > 1) return null;
  const words = new Set(key.split(" "));
  const partial = list.filter((p) => {
    const w = normalizeName(p.name).split(" ").filter(Boolean);
    return w.length > 0 && w.every((x) => words.has(x));
  });
  if (partial.length === 1) return partial[0]!;
  // Varios candidatos: quedarse con el que tenga más palabras en común si es único.
  if (partial.length > 1) {
    const max = Math.max(...partial.map((p) => normalizeName(p.name).split(" ").length));
    const best = partial.filter((p) => normalizeName(p.name).split(" ").length === max);
    if (best.length === 1) return best[0]!;
  }
  return null;
}
