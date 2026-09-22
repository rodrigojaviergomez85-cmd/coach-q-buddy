export type ImportRole = "admin" | "senior" | "coordinador" | "coach" | "qa";

export interface ParsedUserRow {
  name: string;
  email: string;
  role: ImportRole;
}

export interface UserImportParseResult {
  rows: ParsedUserRow[];
  errors: { line: number; raw: string; message: string }[];
}

export const ROLE_LABELS: Record<ImportRole, string> = {
  admin: "Admin",
  senior: "Senior",
  coordinador: "Coordinador",
  coach: "Coach",
  qa: "QA",
};

const ROLE_ALIASES: Record<string, ImportRole> = {
  admin: "admin",
  administrador: "admin",
  senior: "senior",
  coordinator: "coordinador",
  coordinador: "coordinador",
  coach: "coach",
  qa: "qa",
};

export const USERS_CSV_TEMPLATE = "name,email,role\nEmanuel Ramirez,emanuel@english4kidsonline.com,senior\nCarlos Lopez,carlos.lopez@english4kidsonline.com,coordinator\nMaria Perez,maria.perez@english4kidsonline.com,coach\n";

export function normalizeRole(value: string): ImportRole | null {
  const key = value.trim().toLowerCase();
  return ROLE_ALIASES[key] ?? null;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/i.test(value.trim());
}

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

export function parseUsersCsv(text: string): UserImportParseResult {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const lines = clean.split("\n").filter((l) => l.trim().length > 0);
  const rows: ParsedUserRow[] = [];
  const errors: UserImportParseResult["errors"] = [];
  if (lines.length === 0) return { rows, errors };

  const header = splitCsvLine(lines[0]!).map((h) => h.toLowerCase());
  const hasHeader = header.includes("email");
  const idxName = hasHeader ? header.indexOf("name") : 0;
  const idxEmail = hasHeader ? header.indexOf("email") : 1;
  const idxRole = hasHeader ? header.indexOf("role") : 2;

  const seen = new Set<string>();
  for (let i = hasHeader ? 1 : 0; i < lines.length; i += 1) {
    const raw = lines[i]!;
    const cells = splitCsvLine(raw);
    const name = (cells[idxName] ?? "").trim();
    const email = (cells[idxEmail] ?? "").trim().toLowerCase();
    const roleRaw = (cells[idxRole] ?? "").trim();
    const line = i + 1;

    if (!isValidEmail(email)) {
      errors.push({ line, raw, message: `Correo inválido: "${email || "(vacío)"}"` });
      continue;
    }
    const role = normalizeRole(roleRaw);
    if (!role) {
      errors.push({ line, raw, message: `Rol no permitido: "${roleRaw || "(vacío)"}"` });
      continue;
    }
    if (seen.has(email)) {
      errors.push({ line, raw, message: `Correo duplicado en el archivo: ${email}` });
      continue;
    }
    seen.add(email);
    rows.push({ name: name || email.split("@")[0]!, email, role });
  }

  return { rows, errors };
}
