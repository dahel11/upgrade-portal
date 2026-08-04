import { supabase } from "./supabase";
import type { ManualCheckoutResult, ValidateInvoiceResult } from "../types";

/** `supabase.functions.invoke`'s error only says "Edge Function returned a non-2xx status code" —
 * the actual `{ error: "..." }` body the function sent is on `error.context` (a Response). Pull
 * that out so callers (and the console) see the real reason, not just the generic wrapper. */
async function describeFunctionError(error: unknown): Promise<string> {
  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const body = await context.clone().json();
        return body?.error ?? body?.message ?? JSON.stringify(body);
      } catch {
        try {
          return await context.clone().text();
        } catch {
          // fall through to generic message below
        }
      }
    }
  }
  return error instanceof Error ? error.message : String(error);
}

export interface ValidateInvoiceParams {
  user_id: string;
  finance_payment_type: string;
  payment_category: "installment" | "full_payment";
  offering_ids: string[];
  subscription_starts_in: string;
}

export async function validateInvoice(params: ValidateInvoiceParams): Promise<ValidateInvoiceResult> {
  console.log("[validate-invoice] request params:", params);

  const { data, error } = await supabase.functions.invoke<ValidateInvoiceResult>("validate-invoice", {
    body: params,
  });

  if (error) {
    const detail = await describeFunctionError(error);
    console.error("[validate-invoice] failed:", detail);
    throw new Error(detail);
  }
  if (!data) throw new Error("validate-invoice returned no data");

  console.log("[validate-invoice] response:", data);
  return data;
}

export interface ScheduleChoiceEntry {
  offering_id: string;
  slot_label: string;
  /** Extra context stored for audit/notifications — not used by manual-checkout server-side. */
  offering_name?: string;
  day?: string;
  time?: string;
  teacher?: string;
  /** Full raw slot as returned by /api/class-schedule, so admins can inspect fields (e.g.
   * seats_remaining, slot_start_date) beyond what's flattened above without another round-trip. */
  slot?: ScheduleSlot;
}

export interface ManualCheckoutParams {
  invoice_validation_id: string;
  schedule_choice: Record<string, ScheduleChoiceEntry>;
}

export async function manualCheckout(params: ManualCheckoutParams): Promise<ManualCheckoutResult> {
  console.log("[manual-checkout] request params:", params);

  const { data, error } = await supabase.functions.invoke<ManualCheckoutResult>("manual-checkout", {
    body: params,
  });

  if (error) {
    const detail = await describeFunctionError(error);
    console.error("[manual-checkout] failed:", detail);
    throw new Error(detail);
  }
  if (!data) throw new Error("manual-checkout returned no data");

  console.log("[manual-checkout] response:", data);
  return data;
}

export interface ScheduleSlot {
  day: string;
  time: string;
  teacher: string;
  seats_remaining: number;
  slot_label: string;
  /** "YYYY-MM-DD", or `null` if the upstream schedule API didn't return one for this slot. See
   * `classStartLabel` in lib/format.ts for how this becomes a badge. */
  slot_start_date: string | null;
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

