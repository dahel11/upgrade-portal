// finance_payment_type resolution per
// engineering/package_purchases/UPGRADE_PORTAL_FINANCE_PAYMENT_TYPE_GUIDE.md, sections 3b/5a/5b.
//
// Originally this portal only ever reached users who already had an active retention invoice
// (the landing-page gating condition), so every resolved type was unconditionally the
// `retained_`-prefixed variant — see plan decision #1 in the build plan. That stopped being true
// once the semesterly_students_targetted bucket was added (src/lib/data.ts,
// resolveCurrentPackageSource): those users are in the guide's "existing_paid_user" state (paid,
// but no active invoice), not "retained" state. The `retained_*` family specifically requires a
// pre-existing ACTIVE invoice (`Finance.recent_active_retained_invoice`) — calling it without one
// fails validate_invoice with `"No active invoice found"` (confirmed in production, 2026-08-05,
// against a semesterly_students_targetted test user). The plain family (`subject_upgrade`,
// `program_upgrade`, ...) is the correct choice for that population instead.

export interface FinancePaymentTypeFlags {
  /** Same subject, higher-frequency main_course variant selected (e.g. 1x/Minggu -> 2x/Minggu). */
  programChanged: boolean;
  /** A brand-new add_on_course subject selected (e.g. IPA). */
  subjectAdded: boolean;
  /** Final tenor differs from the user's current tenure. */
  tenureChanged: boolean;
  /** Whether the user has a pre-existing ACTIVE invoice — true only for the retention_to_finances
   * population (definitionally gated on one). False for semesterly_students_targetted, which has
   * no such invoice at all. Determines whether the `retained_` prefix is used. */
  hasActiveInvoice: boolean;
}

export function resolveFinancePaymentType({
  programChanged,
  subjectAdded,
  tenureChanged,
  hasActiveInvoice,
}: FinancePaymentTypeFlags): string {
  const prefix = hasActiveInvoice ? "retained_" : "";

  // Unreachable from this function's one call site today (AddSubjectSchedulePage always selects
  // at least one offering, so programChanged/subjectAdded is never both false) — kept for
  // completeness matching section 5a's plain-renewal types.
  if (!programChanged && !subjectAdded) {
    return hasActiveInvoice ? (tenureChanged ? "retained_tenure_upgrade" : "retained") : "";
  }

  const parts: string[] = [];
  if (programChanged) parts.push("program");
  if (subjectAdded) parts.push("subject");
  if (tenureChanged) parts.push("tenure");
  parts.push("upgrade");

  return prefix + parts.join("_");
}
