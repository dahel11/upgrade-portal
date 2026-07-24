import { supabase } from "./supabase";
import { parseIndonesianDateList } from "./format";
import type { CheckoutMeta, OfferingMapping, RetentionFinance, RetentionPayment, Tenor } from "../types";

export async function fetchRetentionFinance(userId: string): Promise<RetentionFinance | null> {
  const { data, error } = await supabase
    .from("retention_to_finances")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data as RetentionFinance | null;
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

/** Reusable student/parent identity fields, sourced from the most recently generated payment
 * link's `meta` for this user (any tenor variant — these fields don't change per-offering). */
export function findLatestContactMeta(payments: RetentionPayment[]) {
  const withMeta = payments.filter((p) => p.meta);
  if (withMeta.length === 0) return null;
  return withMeta[withMeta.length - 1].meta;
}

/**
 * Derives the display period (start/end ISO dates) for an already-generated payment link, straight
 * from its stored `meta` — no live `validate_invoice` call needed for the renewal flow (see build
 * plan decision #2). Prefers `payment_for_date`/`payment_till_date` (the literal billing-coverage
 * fields the backend already computed for this exact invoice); falls back to the invoice's
 * semester bounds if those are missing.
 *
 * ⚠️ Not yet verified against a real "monthly"/"semesterly" (non-`new_sales`) renewal row — flagged
 * as an open item in the build plan. `new_sales_*` sample data available so far reflects original
 * enrollment dates, not necessarily a subsequent renewal's period.
 */
export function derivePeriodFromMeta(meta: CheckoutMeta): { start: string; end: string } {
  if (meta.payment_for_date && meta.payment_till_date) {
    const starts = parseIndonesianDateList(meta.payment_for_date);
    return { start: starts[0], end: meta.payment_till_date.slice(0, 10) };
  }
  return { start: meta.invoice.semester_start_date, end: meta.invoice.semester_end_date };
}
