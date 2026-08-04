import { supabase } from "./supabase";
import { parseIndonesianDateList } from "./format";
import type {
  CheckoutTransaction,
  InvoiceStatus,
  OfferingMapping,
  RetentionFinance,
  RetentionPayment,
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
    .eq("user_id", userId);

  if (error) throw error;
  return (data ?? []) as RetentionPayment[];
}

export async function fetchOfferingMappingForGrade(grade: string): Promise<OfferingMapping[]> {
  const { data, error } = await supabase.from("offering_mapping_to_grade").select("*").eq("grade", grade);

  if (error) throw error;
  return (data ?? []) as OfferingMapping[];
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
