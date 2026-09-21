/** Utilidades puras para importar coaches desde CSV. */

export type CoachCsvFormat = "teachers_list" | "simple";

export interface TeachersListRow {
  external_id: string | null;
  full_name: string;
  email: string | null;
  coordinator_name: string | null;
  senior_name: string | null;
  country: string | null;
  csat_level: string | null;
  first_class_date: string | null;
  tenure_months: number | null;
  phone: string | null;
  active: boolean;
}

/** Quita tildes y pasa a minúsculas para comparar nombres. */
export function normalizeName(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** "STEFANY MELLISA CAMEY" → "Stefany Mellisa Camey" */
export function toTitleCase(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) =>
      word
        .split("-")
        .map((part) =>
          part.length === 0 ? part : part[0]!.toUpperCase() + part.slice(1).toLowerCase(),
        )
        .join("-"),
    )
    .join(" ");
}

/** Deja solo dígitos con el "+" inicial; elimina U+202A/U+202C, NBSP y espacios. */
export function cleanPhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const stripped = value.replace(/[\u202a-\u202e\u200e\u200f\u00a0\s]/g, "");
  const plus = stripped.trim().startsWith("+");
  const digits = stripped.replace(/\D/g, "");
  if (!digits) return null;
  return plus ? `+${digits}` : digits;
}

/** "05/03/2024" (dd/mm/yyyy) → "2024-03-05" */
export function parseDmyDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (!match) return null;
  const [, d, m, y] = match;
  return `${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
}

/** Detecta el formato según las cabeceras (en minúsculas). */
export function detectCsvFormat(headers: string[]): CoachCsvFormat {
  const set = new Set(headers.map((h) => h.trim().toLowerCase()));
  if (set.has("id") && set.has("name") && set.has("coord")) return "teachers_list";
  return "simple";
}

const IGNORED = new Set([
  "zoom_user",
  "zoom_pw",
  "folder",
  "certs",
  "username",
  "reason_deactivated",
  "date_deactivated",
  "created",
  "modified",
  "advanced_capable",
  "beginning_capable",
]);

export function isIgnoredColumn(header: string): boolean {
  return IGNORED.has(header.trim().toLowerCase());
}

function pick(record: Record<string, string>, key: string): string {
  return (record[key] ?? "").trim();
}

/** Mapea una fila del export teachersList al modelo de coaches. */
export function mapTeachersListRow(record: Record<string, string>): TeachersListRow | null {
  const name = pick(record, "name");
  if (!name) return null;
  const tenureRaw = pick(record, "tenure_in_months").replace(",", ".");
  const tenure = tenureRaw === "" ? null : Number(tenureRaw);
  return {
    external_id: pick(record, "id") || null,
    full_name: toTitleCase(name),
    email: pick(record, "coach_email").toLowerCase() || null,
    coordinator_name: pick(record, "coord") ? toTitleCase(pick(record, "coord")) : null,
    senior_name: pick(record, "team") || null,
    country: pick(record, "country") || null,
    csat_level: pick(record, "level") || null,
    first_class_date: parseDmyDate(pick(record, "first_class_start_date")),
    tenure_months: tenure != null && Number.isFinite(tenure) ? tenure : null,
    phone: cleanPhone(pick(record, "phone")),
    active: pick(record, "status").toLowerCase() === "active",
  };
}
