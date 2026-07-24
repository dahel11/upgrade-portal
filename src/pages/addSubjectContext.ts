import type { OfferingMapping, RetentionFinance, Tenor, ValidateInvoiceResult } from "../types";
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
  finance: RetentionFinance;
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
