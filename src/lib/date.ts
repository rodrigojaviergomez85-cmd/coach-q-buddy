/** Fechas en zona America/El_Salvador. */
export const TIME_ZONE = "America/El_Salvador";

/** Fecha "YYYY-MM-DD" de hoy en El Salvador. */
export function todaySV(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Primer día del mes actual en El Salvador ("YYYY-MM-01"). */
export function monthStartSV(): string {
  return `${todaySV().slice(0, 7)}-01`;
}

/** Primer día del mes siguiente en El Salvador. */
export function nextMonthStartSV(): string {
  const parts = todaySV().split("-").map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const year = m === 12 ? y + 1 : y;
  const month = m === 12 ? 1 : m + 1;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/** Formatea una fecha ISO corta para mostrar. */
export function formatDateSV(value: string | null | undefined, lang: "es" | "en" = "es"): string {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00Z`);
  return new Intl.DateTimeFormat(lang === "es" ? "es-SV" : "en-US", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
