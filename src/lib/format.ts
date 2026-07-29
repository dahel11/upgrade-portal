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

/** `retention_to_finances.offering_names` is a comma-separated string (e.g. "Matematika
 * 1x/Minggu - Kelas 8, IPA - Kelas 8") — split into individual, grade-suffix-stripped package
 * names for display as separate chips instead of one run-on line. */
export function splitOfferingNames(value: string): string[] {
  return value
    .split(",")
    .map((name) => stripGradeSuffix(name))
    .filter(Boolean);
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
 * Strips both the grade suffix and the frequency marker ("1x/Minggu", "2x/Minggu", ...). Fallback
 * only — prefer `OfferingMapping.subject` (the authoritative column) when available. */
export function subjectFamily(name: string): string {
  return subjectDisplayName(name).toLowerCase();
}

/** Normalizes any subject-ish string (either `OfferingMapping.subject` or `.name`) into a
 * comparison/lookup key — strips grade suffix, casing, and any weekly-frequency marker ("2x",
 * "2x/Minggu"). Needed because `OfferingMapping.subject` has been observed to sometimes carry the
 * frequency marker itself (e.g. "Matematika 2x") rather than a clean subject name, which broke
 * same-subject matching when compared/looked-up verbatim. */
export function normalizeSubjectKey(raw: string): string {
  return stripGradeSuffix(raw)
    .toLowerCase()
    .replace(/\d+\s*x\s*(\/\s*minggu)?/gi, "")
    .replace(/[^a-z]/g, "");
}

/** Extracts the weekly frequency marker from an offering name (e.g. "Matematika 2x/Minggu -
 * Kelas 10" -> "2x"). Used as the class-schedule API's optional `frequency` param — only
 * Matematika's schedule feed distinguishes 1x/2x; other subjects ignore it. */
export function offeringFrequency(name: string): string | null {
  const match = name.match(/(\d+)\s*x\s*\/\s*minggu/i);
  return match ? `${match[1]}x` : null;
}

/** First word of a full name, for a friendlier greeting ("Joshua albert" -> "Joshua"). */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/** Whole days remaining until an ISO date, relative to now. Negative if already past. */
export function daysUntil(isoDate: string): number {
  const target = new Date(isoDate).getTime();
  const now = Date.now();
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

/** Parses a "DD-MM-YYYY" (optionally comma-separated list) date string, as seen in
 * `retention_to_payments.payment_for_date`, returning ISO (YYYY-MM-DD) strings. */
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

// Mirrors package_purchases' Payment::STATUS enum (see supabase/functions/sync-checkout-status).
const INVOICE_STATUS_LABELS: Record<string, string> = {
  initiated: "Diproses",
  pending: "Menunggu Pembayaran",
  paid: "Sudah Dibayar",
  cancelled: "Dibatalkan",
  failed: "Gagal",
  expired: "Kedaluwarsa",
  api_call_failed: "Gagal",
};

/** Human-readable label for an `InvoiceStatus.status` value. `undefined` means
 * sync-checkout-status hasn't picked up this invoice yet (not "unpaid" or "paid" — just unknown). */
export function describeInvoiceStatus(status: string | undefined): string {
  if (!status) return "Memeriksa status...";
  return INVOICE_STATUS_LABELS[status] ?? status;
}

/** CSS class suffix (`option-badge-*`) for an invoice status badge — see `.option-badge-*` in
 * index.css. */
export function invoiceStatusBadgeClass(status: string | undefined): string {
  if (status === "paid") return "option-badge-success";
  if (status === "failed" || status === "cancelled" || status === "api_call_failed") return "option-badge-error";
  if (status === "expired") return "option-badge-muted";
  return "option-badge-warning"; // pending, initiated, or not yet synced
}
