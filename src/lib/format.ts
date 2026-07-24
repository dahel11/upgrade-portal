const idrFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatIdr(amount: number): string {
  return idrFormatter.format(amount);
}

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Jakarta",
});

export function formatDate(isoDate: string): string {
  return dateFormatter.format(new Date(isoDate));
}

export function formatPeriod(startIso: string, endIso: string): string {
  return `${formatDate(startIso)} - ${formatDate(endIso)}`;
}

export function addCalendarMonth(isoDate: string): string {
  const date = new Date(isoDate);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}

/** `offering_ids` may arrive as a comma-separated string or a native array depending on how the
 * sync stores the column — normalize to a trimmed string array either way. */
export function parseOfferingIds(value: string | string[] | null | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((id) => id.trim()).filter(Boolean);
  return value
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

/** Offering names in `offering_mapping_to_grade` are suffixed with " - Kelas N" — strip it for
 * display (e.g. "Matematika 2x/Minggu - Kelas 10" -> "Matematika 2x/Minggu"). */
export function stripGradeSuffix(name: string): string {
  return name.replace(/\s*-\s*Kelas\s*\d+\s*$/i, "").trim();
}

/** Strips grade suffix and frequency marker, preserving case — used as the `subject` param for
 * the schedule API (e.g. "Matematika 2x/Minggu - Kelas 10" -> "Matematika"). */
export function subjectDisplayName(name: string): string {
  return stripGradeSuffix(name)
    .replace(/\s*\d+x\/Minggu\s*/i, "")
    .trim();
}

/** The subject "family" a main_course offering belongs to, used to detect a frequency upgrade of
 * the same subject (e.g. "Matematika 1x/Minggu" and "Matematika 2x/Minggu" are the same family).
 * Strips both the grade suffix and the frequency marker ("1x/Minggu", "2x/Minggu", ...). */
export function subjectFamily(name: string): string {
  return subjectDisplayName(name).toLowerCase();
}

/** Parses a "DD-MM-YYYY" (optionally comma-separated list) date string, as seen in
 * `retention_to_payments.meta.payment_for_date`, returning ISO (YYYY-MM-DD) strings. */
export function parseIndonesianDateList(value: string): string[] {
  return value
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      const [day, month, year] = token.split("-");
      return `${year}-${month}-${day}`;
    });
}
