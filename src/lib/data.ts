import { supabase } from "./supabase";
import { parseIndonesianDateList, parseOfferingIds } from "./format";
import { isFrequencyDowngrade } from "./offeringSelection";
import type {
  CheckoutTransaction,
  InvoiceStatus,
  OfferingMapping,
  RetentionFinance,
  RetentionPayment,
  SemesterlyStudentTarget,
  Tenor,
} from "../types";

export async function fetchRetentionFinance(userId: string): Promise<RetentionFinance | null> {
  const { data, error } = await supabase.from("retention_to_finances").select("*").eq("user_id", userId);

  if (error) throw error;
  if (!data || data.length === 0) return null;
  return pickRetentionFinance(data as RetentionFinance[]);
}

/**
 * `retention_to_finances` isn't guaranteed unique per user_id — a user can carry a stale/failed
 * sync artifact (e.g. `retention_status: "import_failed"`) or an older already-`completed` cycle
 * alongside their current one. Mirrors `findRenewalPaymentLink`'s tie-break below: prefer the
 * currently-actionable "active" entry, then a "completed" one, falling back to the first row if
 * neither status is present.
 */
function pickRetentionFinance(rows: RetentionFinance[]): RetentionFinance {
  const active = rows.find((r) => r.retention_status === "active" && r.invoice_status === "active");
  if (active) return active;

  const completed = rows.find((r) => r.retention_status === "completed");
  if (completed) return completed;

  return rows[0];
}

export async function fetchRetentionPayments(userId: string): Promise<RetentionPayment[]> {
  const { data, error } = await supabase
    .from("retention_to_payments")
    .select("*")
    .eq("user_id", userId)
    .eq("retention_status", "active")
    .eq("status", "pending");

  if (error) throw error;
  return (data ?? []) as RetentionPayment[];
}

export async function fetchOfferingMappingForGrade(grade: string): Promise<OfferingMapping[]> {
  const { data, error } = await supabase.from("offering_mapping_to_grade").select("*").eq("grade", grade);

  if (error) throw error;
  return (data ?? []) as OfferingMapping[];
}

export async function fetchSemesterlyStudentTarget(userId: string): Promise<SemesterlyStudentTarget | null> {
  const { data, error } = await supabase.from("semesterly_students_targetted").select("*").eq("user_id", userId);

  if (error) throw error;
  if (!data || data.length === 0) return null;
  return pickSemesterlyStudentTarget(data as SemesterlyStudentTarget[]);
}

/** No status column on this table (unlike retention_to_finances) to prefer an "active" row by —
 * tie-break on most recent created_at instead. */
function pickSemesterlyStudentTarget(rows: SemesterlyStudentTarget[]): SemesterlyStudentTarget {
  return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}

export type PackageSource =
  | { kind: "retention"; finance: RetentionFinance }
  | { kind: "semesterly-upsell"; target: SemesterlyStudentTarget }
  | { kind: "none" };

/**
 * Single source of truth for the retention-vs-semesterly-bucket priority rule, shared by
 * LandingPage and AddSubjectFlowLayout so the branch logic isn't duplicated in two places that
 * could drift out of sync. Priority: an ACTIVE retention_to_finances row always wins (renewal is
 * more urgent than an upsell). Otherwise, fall back to semesterly_students_targetted. Otherwise
 * fall back to whatever retention row exists (possibly none) — preserves today's "Terima
 * kasih!"/"Belum ada langkah" behavior for users in neither bucket.
 */
export async function resolveCurrentPackageSource(userId: string): Promise<PackageSource> {
  const [finance, semesterlyTarget] = await Promise.all([
    fetchRetentionFinance(userId),
    fetchSemesterlyStudentTarget(userId),
  ]);

  const isActive = !!finance && finance.retention_status === "active" && finance.invoice_status === "active";

  if (finance && isActive) return { kind: "retention", finance };
  if (semesterlyTarget) return { kind: "semesterly-upsell", target: semesterlyTarget };
  if (finance) return { kind: "retention", finance };
  return { kind: "none" };
}

export interface CurrentPackageSummary {
  userName: string;
  grade: string;
  offeringIds: string[];
  sourceKind: "retention" | "semesterly-upsell";
}

/** Normalizes either source into the minimal shape the add-subject flow actually needs. `null`
 * only for `kind: "none"` (callers should already have handled that case before reaching here). */
export function summarizePackageSource(source: PackageSource): CurrentPackageSummary | null {
  if (source.kind === "retention") {
    return {
      userName: source.finance.user_name,
      grade: source.finance.grade,
      offeringIds: parseOfferingIds(source.finance.offering_ids),
      sourceKind: "retention",
    };
  }
  if (source.kind === "semesterly-upsell") {
    return {
      userName: source.target.students_name,
      grade: source.target.grade,
      offeringIds: parseOfferingIds(source.target.offering_ids),
      sourceKind: "semesterly-upsell",
    };
  }
  return null;
}

/** Never offer a same-subject variant at a lower weekly frequency than what the user already has
 * (downgrades aren't allowed, per product direction) — shared by AddSubjectFlowLayout (to build
 * the add-subject wizard's catalog) and LandingPage (to decide whether a semesterly-bucket user
 * has anything left to upsell into at all). */
export async function computeAvailableOfferings(
  summary: CurrentPackageSummary,
): Promise<{ currentOfferings: OfferingMapping[]; availableOfferings: OfferingMapping[] }> {
  const catalog = await fetchOfferingMappingForGrade(summary.grade);
  const currentIds = new Set(summary.offeringIds);
  const currentOfferings = catalog.filter((o) => currentIds.has(o.id));
  const availableOfferings = catalog.filter(
    (o) => !currentIds.has(o.id) && !isFrequencyDowngrade(o, currentOfferings),
  );
  return { currentOfferings, availableOfferings };
}

export async function fetchCheckoutTransactions(userId: string): Promise<CheckoutTransaction[]> {
  const { data, error } = await supabase
    .from("checkout_transactions")
    .select("id, invoice_validation_id, user_id, created_at, invoice_id, invoice_url")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as CheckoutTransaction[];
}

export async function fetchInvoiceStatuses(invoiceIds: string[]): Promise<InvoiceStatus[]> {
  if (invoiceIds.length === 0) return [];

  const { data, error } = await supabase.from("checkout_invoice_statuses").select("*").in("invoice_id", invoiceIds);

  if (error) throw error;
  return (data ?? []) as InvoiceStatus[];
}

/**
 * Transactions to warn about before letting the user generate another checkout — i.e. "did you
 * already generate a link you haven't paid yet". A transaction with no synced status row yet
 * (sync-checkout-status hasn't picked it up) is treated as pending too, since "unknown" is closer
 * to "maybe still unpaid" than to "safe to ignore". `expired` is deliberately excluded: it can no
 * longer be paid, so it's not something to warn about (open item — revisit if product wants it
 * flagged too, e.g. to point at exactly which subject that was for).
 */
export async function fetchPendingCheckoutTransactions(userId: string): Promise<CheckoutTransaction[]> {
  const transactions = await fetchCheckoutTransactions(userId);
  if (transactions.length === 0) return [];

  const statuses = await fetchInvoiceStatuses(transactions.map((t) => t.invoice_id));
  const statusByInvoiceId = new Map(statuses.map((s) => [s.invoice_id, s.status]));

  return transactions.filter((t) => (statusByInvoiceId.get(t.invoice_id) ?? "pending") === "pending");
}

/**
 * Finds the pre-generated payment link matching the chosen renewal tenor. Wildcard-matches
 * `payment_type` (e.g. "new_sales_monthly" and "monthly_late_payment" both match "monthly") —
 * intentionally broad, per product decision. When more than one row matches, prefers
 * `status=pending` over `expired`.
 */
export function findRenewalPaymentLink(payments: RetentionPayment[], tenor: Tenor): RetentionPayment | null {
  const keyword = tenor === "monthly" ? "monthly" : "semesterly";
  const matches = payments.filter((p) => p.payment_type.includes(keyword));
  if (matches.length === 0) return null;

  const pending = matches.find((p) => p.status === "pending");
  return pending ?? matches[0];
}

/**
 * Derives the display period (start/end ISO dates) for an already-generated payment link, straight
 * from its synced pricing/period columns — no live `validate_invoice` call needed for the renewal
 * flow (see build plan decision #2). Prefers `payment_for_date`/`payment_till_date` (the literal
 * billing-coverage fields the backend already computed for this exact invoice); falls back to the
 * invoice's semester bounds if those are missing.
 *
 * Verified against a real "monthly"/"semesterly" (non-`new_sales`) renewal row (2026-08-03):
 * `payment_for_date`/`payment_till_date` are populated on both, so the fallback branch is only hit
 * when those are genuinely absent.
 */
export function derivePeriodFromPayment(payment: RetentionPayment): { start: string; end: string } {
  if (payment.payment_for_date && payment.payment_till_date) {
    const starts = parseIndonesianDateList(payment.payment_for_date);
    return { start: starts[0], end: payment.payment_till_date.slice(0, 10) };
  }
  return { start: payment.semester_start_date ?? "", end: payment.semester_end_date ?? "" };
}
