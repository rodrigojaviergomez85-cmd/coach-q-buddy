import { normalizeName } from "./coach-import";

export interface CoachNameRow {
  name: string;
  role: "coach";
  coordinator: string;
}

export interface CoachNameParseResult {
  rows: CoachNameRow[];
  errors: { line: number; message: string }[];
  missingColumns: string[];
}

export const COACHES_CSV_TEMPLATE =
  "name,role,coordinator\nSTEFANY MELLISA CAMEY RODRIGUEZ,coach,KATYA LISBETH CHICAS REYES\nMARIA JUANA FLORES DE RIVAS,coach,FRIDA ALEJANDRA LIMA OROPEZA\n";

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === "," || ch === ";") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

export function parseCoachNameCsv(text: string): CoachNameParseResult {
  const lines = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((l) => l.trim());
  const result: CoachNameParseResult = { rows: [], errors: [], missingColumns: [] };
  if (lines.length === 0) return result;
  const header = splitCsvLine(lines[0]!).map((h) => h.toLowerCase());
  const idx = { name: header.indexOf("name"), role: header.indexOf("role"), coordinator: header.indexOf("coordinator") };
  result.missingColumns = (Object.keys(idx) as (keyof typeof idx)[]).filter((k) => idx[k] < 0);
  if (result.missingColumns.length) return result;

  const seen = new Set<string>();
  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i]!);
    const name = (cells[idx.name] ?? "").trim();
    const role = (cells[idx.role] ?? "").trim().toLowerCase();
    const coordinator = (cells[idx.coordinator] ?? "").trim();
    const line = i + 1;
    if (!name) { result.errors.push({ line, message: "Nombre vacío" }); continue; }
    if (role !== "coach") { result.errors.push({ line, message: `Rol no permitido: "${role || "(vacío)"}"` }); continue; }
    if (!coordinator) { result.errors.push({ line, message: "Coordinador vacío" }); continue; }
    const key = normalizeName(name);
    if (seen.has(key)) { result.errors.push({ line, message: `Coach duplicado en el archivo: ${name}` }); continue; }
    seen.add(key);
    result.rows.push({ name, role: "coach", coordinator });
  }
  return result;
}
