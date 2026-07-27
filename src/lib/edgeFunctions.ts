import { supabase } from "./supabase";
import type { ManualCheckoutResult, ValidateInvoiceResult } from "../types";

export interface ValidateInvoiceParams {
  user_id: string;
  finance_payment_type: string;
  payment_category: "installment" | "full_payment";
  offering_ids: string[];
  subscription_starts_in: string;
}

export async function validateInvoice(params: ValidateInvoiceParams): Promise<ValidateInvoiceResult> {
  const { data, error } = await supabase.functions.invoke<ValidateInvoiceResult>("validate-invoice", {
    body: params,
  });

  if (error) throw error;
  if (!data) throw new Error("validate-invoice returned no data");
  return data;
}

export interface ManualCheckoutParams {
  invoice_validation_id: string;
  schedule_choice: Record<string, { offering_id: string; slot_label: string }>;
}

export async function manualCheckout(params: ManualCheckoutParams): Promise<ManualCheckoutResult> {
  const { data, error } = await supabase.functions.invoke<ManualCheckoutResult>("manual-checkout", {
    body: params,
  });

  if (error) throw error;
  if (!data) throw new Error("manual-checkout returned no data");
  return data;
}

export interface ScheduleSlot {
  day: string;
  time: string;
  teacher: string;
  seats_remaining: number;
  slot_label: string;
}

/** `frequency` (e.g. "2x") only matters for Matematika's schedule feed — see
 * `offeringFrequency()` in lib/format.ts. Calls `/api/class-schedule` (this portal's own
 * endpoint) — NOT `/api/schedule`, which is left untouched for whatever the legacy portal/other
 * consumers depend on. `class-schedule.js` already normalizes the upstream (Google Apps Script)
 * response into this exact shape, filtered to `status: "Available"`. */
export async function fetchScheduleSlots(kelas: string, subject: string, frequency?: string): Promise<ScheduleSlot[]> {
  const params = new URLSearchParams({ kelas, subject });
  if (frequency) params.set("frequency", frequency);

  const response = await fetch(`/api/class-schedule?${params.toString()}`);
  if (!response.ok) throw new Error("Failed to fetch schedule");
  return response.json();
}
