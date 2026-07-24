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

/**
 * ⚠️ The AWS `slotschedule` endpoint's exact response field names haven't been verified against a
 * live call (no reachable credentials/network at build time) — this normalizer accepts a few
 * plausible key spellings inferred from the `archived-2342324323.html` legacy form and the jadwal
 * mockup. Re-check against a real response before shipping and tighten this if needed.
 */
function normalizeSlot(raw: Record<string, unknown>): ScheduleSlot {
  const day = String(raw.day ?? raw.hari ?? "");
  const time = String(raw.time ?? raw.jam ?? raw.waktu ?? "");
  const teacher = String(raw.teacher ?? raw.guru ?? raw.tutor_name ?? "");
  const seats = Number(raw.seats_remaining ?? raw.sisa_kursi ?? raw.available_seats ?? 0);
  return {
    day,
    time,
    teacher,
    seats_remaining: seats,
    slot_label: String(raw.slot_label ?? raw.id ?? `${day}-${time}-${teacher}`),
  };
}

export async function fetchScheduleSlots(kelas: string, subject: string): Promise<ScheduleSlot[]> {
  const response = await fetch(`/api/schedule?kelas=${encodeURIComponent(kelas)}&subject=${encodeURIComponent(subject)}`);
  if (!response.ok) throw new Error("Failed to fetch schedule");
  const raw = await response.json();
  const list: unknown[] = Array.isArray(raw) ? raw : (raw.data ?? raw.slots ?? []);
  return list.map((item) => normalizeSlot(item as Record<string, unknown>));
}
