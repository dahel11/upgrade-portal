// finance_payment_type resolution per
// engineering/package_purchases/UPGRADE_PORTAL_FINANCE_PAYMENT_TYPE_GUIDE.md, sections 5a/5b.
//
// This portal only ever reaches users who already have an active retention invoice (that's the
// landing-page gating condition itself), so every resolved type is the `retained_`-prefixed
// variant — see plan decision #1 in the build plan.

export interface FinancePaymentTypeFlags {
  /** Same subject, higher-frequency main_course variant selected (e.g. 1x/Minggu -> 2x/Minggu). */
  programChanged: boolean;
  /** A brand-new add_on_course subject selected (e.g. IPA). */
  subjectAdded: boolean;
  /** Final tenor differs from the user's current tenure. */
  tenureChanged: boolean;
}

export function resolveFinancePaymentType({
  programChanged,
  subjectAdded,
  tenureChanged,
}: FinancePaymentTypeFlags): string {
  if (!programChanged && !subjectAdded) {
    return tenureChanged ? "retained_tenure_upgrade" : "retained";
  }

  const parts = ["retained"];
  if (programChanged) parts.push("program");
  if (subjectAdded) parts.push("subject");
  parts.push("upgrade");
  if (tenureChanged) parts.splice(parts.length - 1, 0, "tenure");

  return parts.join("_");
}
