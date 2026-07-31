// Mirrors the Metabase-sourced Supabase tables. See
// memory: project-upgrade-portal-data-sources / question #4547, #4549, #4553.

export interface RetentionFinance {
  id: string;
  invoice_number: string;
  user_name: string;
  user_id: string;
  // Nullable: real Metabase data leaves these blank on a meaningful share of rows (older/inactive
  // retention records that never reach the pricing screens anyway).
  due_date: string | null;
  retention_status: string;
  invoice_status: string;
  monthly_price: number | null;
  semesterly_price: number | null;
  payment_date: string | null;
  grade: string;
  offering_names: string;
  /** Comma-separated in the source export; may arrive as a Postgres array depending on how the
   * sync stores it — always read through `parseOfferingIds`. */
  offering_ids: string | string[];
}

// Originally this table stored the *entire* body used to generate the Xendit link as one `meta`
// jsonb blob (~1.5KB/row, mostly finance/invoice fields for a past, unrelated checkout). At ~18k
// rows that was the single biggest contributor to sync-retention-payments hitting
// WORKER_RESOURCE_LIMIT. Only a handful of scalar fields were ever actually read from it — contact
// identity fields (for manual-checkout) and a few pricing/period fields (for the renewal flow's
// Ringkasan Pembayaran, which deliberately avoids a live validate_invoice call — see build plan
// decision #2). Those are now synced as flat columns instead of a nested blob.
export interface RetentionPayment {
  id: string;
  invoice_number: string;
  user_id: string;
  due_date: string | null;
  retention_status: string;
  payment_type: string;
  invoice_url: string;
  status: "pending" | "expired" | string;

  // Contact identity fields — used server-side by manual-checkout, not by the frontend directly.
  student_name: string | null;
  student_email: string | null;
  student_grade: string | null;
  student_country_code: string | null;
  student_phone_number: string | null;
  parent_name: string | null;
  parent_email: string | null;
  parent_country_code: string | null;
  parent_phone_number: string | null;
  contactable_whatsapp_number: string | null;
  sales_agent_email: string | null;

  // Pricing/period fields — used by the renewal flow's Ringkasan Pembayaran.
  net_invoice: number | null;
  semester_start_date: string | null;
  semester_end_date: string | null;
  /** Raw "DD-MM-YYYY[, DD-MM-YYYY...]" string — parse with `parseIndonesianDateList`. */
  payment_for_date: string | null;
  payment_till_date: string | null;
}

export interface OfferingMapping {
  id: string;
  reference_type: "main_course" | "add_on_course";
  price: number;
  grade: string;
  name: string;
  /** Authoritative subject name (e.g. "Matematika", "IPA", "Fisika", "Kimia") — used for
   * same-subject frequency-upgrade detection and as the schedule API's `subject` param. Nullable
   * only until a resync backfills rows synced before this column existed. */
  subject: string | null;
  /** Short blurb describing what the student will learn — shown in the offering info panel. */
  description: string | null;
  created_at: string;
  updated_at: string;
}

export type Tenor = "monthly" | "semesterly";

export interface ValidateInvoiceResult {
  invoice_validation_id: string;
  finance_payment_type: string;
  payment_category: "installment" | "full_payment";
  offering_ids: string[];
  offering_names: string[];
  net_invoice: number;
  base_price: number;
  total_discount: number;
  period_start: string;
  period_end: string;
}

export interface ManualCheckoutResult {
  invoice_url: string;
  invoice_id: string;
}

export interface CheckoutTransaction {
  id: string;
  invoice_validation_id: string;
  user_id: string;
  created_at: string;
  invoice_id: string;
  invoice_url: string;
}

// Synced from Metabase question #1938 (see supabase/functions/sync-checkout-status) — the only way
// this app can observe payment status, since package_purchases has no live status-check API and
// this app has no direct DB access. `invoice_id` matches CheckoutTransaction.invoice_id
// (package_purchases' `payments.id`) — joined client-side, not via a SQL join.
export interface InvoiceStatus {
  invoice_id: string;
  user_id: string;
  status: "initiated" | "pending" | "paid" | "cancelled" | "failed" | "expired" | "api_call_failed" | string;
  paid_at: string | null;
  paid_amount: number | null;
  total_amount: number | null;
  invoice_url: string | null;
  receipt_number: string | null;
  synced_at: string;
}
