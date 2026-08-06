import { normalizeSubjectKey, offeringFrequency } from "./format";
import type { OfferingMapping, Tenor } from "../types";

/** Prefer the authoritative `subject` column, normalized to strip any frequency marker it might
 * carry (observed in real data, e.g. "Matematika 2x" instead of a clean "Matematika") so two
 * frequency variants of the same subject still compare equal; falls back to the offering's `name`
 * for rows synced before the `subject` column existed. */
export function subjectOf(offering: OfferingMapping): string {
  return normalizeSubjectKey(offering.subject ?? offering.name);
}

/** Numeric weekly frequency parsed from the offering's name (e.g. "Matematika 2x/Minggu" -> 2).
 * `null` for subjects with no frequency marker at all (IPA, Fisika, Kimia, ...) — those have only
 * one variant, so there's nothing to compare. */
function frequencyOf(offering: OfferingMapping): number | null {
  const marker = offeringFrequency(offering.name);
  if (!marker) return null;
  const match = marker.match(/\d+/);
  return match ? Number(match[0]) : null;
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

/** True when `offering` is a same-subject main_course variant at a *lower* weekly frequency than
 * one the user already has (e.g. currently on "Matematika 2x/Minggu", candidate is "Matematika
 * 1x/Minggu") — downgrades aren't offered. Only compares when both sides have a parseable
 * frequency marker; subjects without one (no frequency variants to begin with) are never flagged. */
export function isFrequencyDowngrade(offering: OfferingMapping, currentOfferings: OfferingMapping[]): boolean {
  if (offering.reference_type !== "main_course") return false;
  const candidateFrequency = frequencyOf(offering);
  if (candidateFrequency === null) return false;

  const subject = subjectOf(offering);
  return currentOfferings.some((o) => {
    if (o.reference_type !== "main_course" || subjectOf(o) !== subject) return false;
    const currentFrequency = frequencyOf(o);
    return currentFrequency !== null && candidateFrequency < currentFrequency;
  });
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
 * The retention campaign's population is assumed to be entirely on a monthly tenure today (see
 * build plan, decision "current tenure detection") — there's no reliable per-user tenure signal
 * in retention_to_finances/retention_to_payments. The semesterly_students_targetted bucket is the
 * one population where a real per-user tenure signal DOES exist: it's definitionally why those
 * users are in that bucket, so their current tenure is always "semesterly", never "monthly".
 */
export function getAssumedCurrentTenure(sourceKind: "retention" | "semesterly-upsell"): Tenor {
  return sourceKind === "semesterly-upsell" ? "semesterly" : "monthly";
}
