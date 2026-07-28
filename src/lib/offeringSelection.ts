import { subjectFamily } from "./format";
import type { OfferingMapping } from "../types";

/** Prefer the authoritative `subject` column (lowercased for comparison); fall back to
 * regex-guessing from `name` only for rows synced before that column existed (should self-heal
 * after the next sync). */
export function subjectOf(offering: OfferingMapping): string {
  return (offering.subject ?? subjectFamily(offering.name)).toLowerCase();
}

/** True when `offering` is a main_course selection that shares a subject family with something
 * the user already has — i.e. picking it would replace their current variant (see
 * `computeOfferingSelection`). Used to warn upfront that the class/teacher/classmates will change,
 * since that's decided by which schedule slot is available, not by the student's choice. */
export function isFrequencyUpgrade(offering: OfferingMapping, currentOfferings: OfferingMapping[]): boolean {
  if (offering.reference_type !== "main_course") return false;
  const subject = subjectOf(offering);
  return currentOfferings.some((o) => o.reference_type === "main_course" && subjectOf(o) === subject);
}

export interface OfferingSelectionResult {
  finalOfferingIds: string[];
  /** ids that were dropped from the current set because a same-subject frequency upgrade
   * replaced them (guide gotcha #1: send the full resulting set, not a delta). */
  replacedOfferingIds: string[];
  programChanged: boolean;
  subjectAdded: boolean;
}

/**
 * Combines the user's current offerings with newly selected ones into the final `offering_ids`
 * set to send to `validate_invoice`. A newly selected `main_course` offering that shares a
 * subject family with a current offering (e.g. "Matematika 1x/Minggu" -> "Matematika 2x/Minggu")
 * REPLACES the old variant rather than stacking with it. A newly selected `add_on_course`
 * offering is purely additive.
 */
export function computeOfferingSelection(
  currentOfferings: OfferingMapping[],
  selectedOfferings: OfferingMapping[],
): OfferingSelectionResult {
  let finalIds = currentOfferings.map((o) => o.id);
  const replacedOfferingIds: string[] = [];
  let programChanged = false;
  let subjectAdded = false;

  for (const selected of selectedOfferings) {
    if (selected.reference_type === "add_on_course") {
      subjectAdded = true;
      finalIds.push(selected.id);
      continue;
    }

    // main_course: look for an existing offering in the same subject to replace.
    const subject = subjectOf(selected);
    const sameFamilyCurrent = currentOfferings.find(
      (o) => o.reference_type === "main_course" && subjectOf(o) === subject,
    );

    programChanged = true;
    if (sameFamilyCurrent) {
      replacedOfferingIds.push(sameFamilyCurrent.id);
      finalIds = finalIds.filter((id) => id !== sameFamilyCurrent.id);
    }
    finalIds.push(selected.id);
  }

  return { finalOfferingIds: finalIds, replacedOfferingIds, programChanged, subjectAdded };
}

/**
 * This retention campaign's population is assumed to be entirely on a monthly tenure today (see
 * build plan, decision "current tenure detection"). There is no reliable per-user tenure signal
 * in the tables this portal reads. Revisit if/when a real per-user tenure field becomes
 * available.
 */
export function getAssumedCurrentTenure(): "monthly" | "semesterly" {
  return "monthly";
}
