// Mirrors the Metabase-sourced Supabase tables. See
// memory: project-upgrade-portal-data-sources / question #4547, #4549, #4553.

export interface RetentionFinance {
  id: string;
  invoice_number: string;
  user_name: string;
  user_id: string;
  due_date: string;
  retention_status: string;
  invoice_status: string;
  monthly_price: number;
  semesterly_price: number;
  payment_date: string | null;
  grade: string;
  offering_names: string;
  /** Comma-separated in the source export; may arrive as a Postgres array depending on how the
   * sync stores it — always read through `parseOfferingIds`. */
  offering_ids: string | string[];
}

export interface CheckoutMetaDetail {
  course_name?: string;
  offering_name?: string;
  offering_id: string;
  net_invoice: number;
  monthly_price?: number;
  base_price?: number;
  discounts?: unknown[];
  total_discount?: number;
}

export interface CheckoutMetaInvoice {
  discounts: unknown[];
  net_invoice: number;
  monthly_price: number;
  base_price?: number;
  total_discount: number;
  offering_end_date: string;
  semester_end_date: string;
  offering_start_date: string;
  semester_start_date: string;
}

/** The full body originally used to generate a `retention_to_payments` row's Xendit link. */
export interface CheckoutMeta {
  hash: string;
  details: CheckoutMetaDetail[];
  invoice: CheckoutMetaInvoice;
  grade: string;
  amount: number;
  remark?: string;
  finance: { id: string; reference_id: string; invoice_number: string };
  user_id: string;
  refundable?: boolean;
  parent_name: string;
  offering_ids: string[];
  parent_email: string | null;
  payment_type: string;
  student_name: string;
  user_invoice: { discounts: unknown; base_price: number; net_invoice: number; total_discount: number };
  is_automation?: boolean;
  student_email: string | null;
  student_grade: string;
  invoice_number: string;
  retention_type?: string;
  invoice_summary?: unknown;
  payment_context: string;
  tenure_duration: string;
  invoice_duration: number;
  payment_category: "installment" | "full_payment";
  payment_for_date?: string;
  payment_till_date?: string;
  sales_agent_email: string;
  parent_country_code: string;
  parent_phone_number: string;
  finance_payment_type: string;
  student_country_code: string;
  student_phone_number: string;
  retention_payment_type: string;
  subscription_starts_in: string;
  student_is_existing_user?: boolean;
  contactable_whatsapp_number: string;
}

export interface RetentionPayment {
  id: string;
  invoice_number: string;
  user_id: string;
  due_date: string;
  retention_status: string;
  payment_type: string;
  invoice_url: string;
  status: "pending" | "expired" | string;
  meta: CheckoutMeta;
}

export interface OfferingMapping {
  id: string;
  reference_type: "main_course" | "add_on_course";
  price: number;
  grade: string;
  name: string;
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
