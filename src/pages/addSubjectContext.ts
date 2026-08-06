import type { OfferingMapping, Tenor, ValidateInvoiceResult } from "../types";
import type { ScheduleSlot } from "../lib/edgeFunctions";

export interface ScheduleChoice {
  offeringId: string;
  offeringName: string;
  slot: ScheduleSlot;
}

export interface TenorPreview {
  monthly: ValidateInvoiceResult | null;
  semesterly: ValidateInvoiceResult | null;
}

export interface AddSubjectContextValue {
  userId: string;
  userName: string;
  grade: string;
  /** Which bucket resolved this user — drives tenure assumptions (getAssumedCurrentTenure) and
   * whether a monthly tenor option is even offered (semesterly-bucket users never see one, see
   * AddSubjectSchedulePage). */
  sourceKind: "retention" | "semesterly-upsell";
  currentOfferings: OfferingMapping[];
  availableOfferings: OfferingMapping[];

  selectedOfferingIds: string[];
  setSelectedOfferingIds: (ids: string[]) => void;

  scheduleChoices: Record<string, ScheduleChoice>;
  setScheduleChoices: (choices: Record<string, ScheduleChoice>) => void;

  tenorPreview: TenorPreview | null;
  setTenorPreview: (preview: TenorPreview | null) => void;

  chosenTenor: Tenor | null;
  setChosenTenor: (tenor: Tenor | null) => void;
}
