import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { TopBar } from "../components/TopBar";
import { LoadingIndicator } from "../components/LoadingIndicator";
import { computeOfferingSelection, getAssumedCurrentTenure } from "../lib/offeringSelection";
import { resolveFinancePaymentType } from "../lib/financePaymentType";
import { fetchScheduleSlots, validateInvoice, type ScheduleSlot } from "../lib/edgeFunctions";
import { classStartBadgeClass, classStartLabel, formatDate, formatIdr, stripGradeSuffix, subjectDisplayName } from "../lib/format";
import type { OfferingMapping, ValidateInvoiceResult } from "../types";
import type { AddSubjectContextValue, TenorPreview } from "./addSubjectContext";

function parseTimeMinutes(time: string): [number, number] | null {
  const m = time.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return [+m[1] * 60 + +m[2], +m[3] * 60 + +m[4]];
}

function slotsOverlap(a: ScheduleSlot, b: ScheduleSlot): boolean {
  const daysA = new Set(a.day.split(",").map((d) => d.trim().toLowerCase()));
  if (!b.day.split(",").some((d) => daysA.has(d.trim().toLowerCase()))) return false;
  const ta = parseTimeMinutes(a.time);
  const tb = parseTimeMinutes(b.time);
  if (!ta || !tb) return false;
  return ta[0] < tb[1] && tb[0] < ta[1];
}

/** The schedule API's `subject` param comes straight from the offering_mapping_to_grade.subject
 * column (per product decision) — falling back to a regex-derived guess only for rows synced
 * before that column existed. */
function scheduleSubjectOf(offering: OfferingMapping): string {
  return offering.subject ?? subjectDisplayName(offering.name);
}

export function AddSubjectSchedulePage() {
  const ctx = useOutletContext<AddSubjectContextValue>();
  const navigate = useNavigate();

  const selectedOfferings = useMemo(
    () => ctx.availableOfferings.filter((o) => ctx.selectedOfferingIds.includes(o.id)),
    [ctx.availableOfferings, ctx.selectedOfferingIds],
  );

  const [slotsByOffering, setSlotsByOffering] = useState<Record<string, ScheduleSlot[]>>({});
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  // Two explicit stages: pick a schedule slot per subject first ("Lihat jadwal" already got them
  // here); only once they click "Lihat harga" do we call validate-invoice and reveal tenor/price.
  const [showPricing, setShowPricing] = useState(false);

  useEffect(() => {
    if (selectedOfferings.length === 0) {
      navigate(`/${ctx.userId}/add-subject/select`);
      return;
    }

    let cancelled = false;
    setSlotsLoading(true);
    setSlotsError(null);
    Promise.all(
      selectedOfferings.map((offering) =>
        fetchScheduleSlots(ctx.grade, scheduleSubjectOf(offering)).then((slots) => [offering.id, slots] as const),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        setSlotsByOffering(Object.fromEntries(results));
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setSlotsError(err.message);
      })
      .finally(() => {
        if (cancelled) return;
        setSlotsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOfferings.map((o) => o.id).join(",")]);

  function chooseSlot(offering: (typeof selectedOfferings)[number], slot: ScheduleSlot) {
    ctx.setScheduleChoices({
      ...ctx.scheduleChoices,
      [offering.id]: { offeringId: offering.id, offeringName: offering.name, slot },
    });
  }

  const allSlotsChosen = selectedOfferings.every((o) => ctx.scheduleChoices[o.id]);

  const conflictingSlotLabels = useMemo(() => {
    const choices = Object.values(ctx.scheduleChoices);
    const labels = new Set<string>();
    for (let i = 0; i < choices.length; i++) {
      for (let j = i + 1; j < choices.length; j++) {
        if (slotsOverlap(choices[i].slot, choices[j].slot)) {
          labels.add(choices[i].slot.slot_label);
          labels.add(choices[j].slot.slot_label);
        }
      }
    }
    return labels;
  }, [ctx.scheduleChoices]);

  const hasScheduleConflict = conflictingSlotLabels.size > 0;

  function handleLihatHarga() {
    if (!allSlotsChosen) return;
    setShowPricing(true);
    if (ctx.tenorPreview) return; // already fetched (e.g. user went back and forth)

    const { finalOfferingIds, programChanged, subjectAdded } = computeOfferingSelection(
      ctx.currentOfferings,
      selectedOfferings,
    );
    const currentTenure = getAssumedCurrentTenure(ctx.sourceKind);
    // Only the retention_to_finances population is gated on a pre-existing ACTIVE invoice — the
    // `retained_*` finance_payment_type family requires one and fails validate_invoice with
    // "No active invoice found" otherwise. semesterly-upsell users have no active invoice at all
    // (they're in the "existing_paid_user" state per the guide), so they get the plain family
    // instead — see resolveFinancePaymentType's doc comment.
    const hasActiveInvoice = ctx.sourceKind === "retention";

    // Semesterly-bucket users are already committed to semesterly tenure — never offer them a
    // downgrade back to monthly, so skip validating that option entirely rather than just hiding
    // it in the UI after the fact.
    const monthlyPromise: Promise<ValidateInvoiceResult | null> =
      ctx.sourceKind === "semesterly-upsell"
        ? Promise.resolve(null)
        : validateInvoice({
            user_id: ctx.userId,
            finance_payment_type: resolveFinancePaymentType({
              programChanged,
              subjectAdded,
              tenureChanged: currentTenure !== "monthly",
              hasActiveInvoice,
            }),
            payment_category: "installment",
            offering_ids: finalOfferingIds,
            subscription_starts_in: "current_semester",
          });

    setPreviewLoading(true);
    Promise.all([
      monthlyPromise,
      validateInvoice({
        user_id: ctx.userId,
        finance_payment_type: resolveFinancePaymentType({
          programChanged,
          subjectAdded,
          tenureChanged: currentTenure !== "semesterly",
          hasActiveInvoice,
        }),
        payment_category: "full_payment",
        offering_ids: finalOfferingIds,
        subscription_starts_in: "current_semester",
      }),
    ])
      .then(([monthly, semesterly]) => {
        const preview: TenorPreview = { monthly, semesterly };
        ctx.setTenorPreview(preview);
      })
      .catch((err: Error) => setPreviewError(err.message))
      .finally(() => setPreviewLoading(false));
  }

  // hasScheduleConflict is re-checked here too, not just before "Lihat harga": the slot buttons
  // stay clickable while the pricing panel is showing, so a user can pick a conflicting slot again
  // after already reaching this step — confirming must stay blocked either way.
  const canConfirm = showPricing && ctx.tenorPreview && ctx.chosenTenor && !hasScheduleConflict;

  return (
    <div className="screen">
      <TopBar
        showBack
        onBack={() => {
          if (showPricing) {
            setShowPricing(false);
            return;
          }
          navigate(`/${ctx.userId}/add-subject/select`);
        }}
      />
      <h2 className="section-title">Jadwal & tenor</h2>
      <p className="section-hint">{selectedOfferings.map((o) => stripGradeSuffix(o.name)).join(", ")}</p>

      {slotsError && <p className="error-text">Gagal memuat jadwal: {slotsError}</p>}

      {slotsLoading ? (
        <LoadingIndicator label="Mencari jadwal yang tersedia..." />
      ) : (
        selectedOfferings.map((offering) => (
          <div key={offering.id}>
            <h3 className="subsection-title">Jadwal {stripGradeSuffix(offering.name)}</h3>
            <div className="option-list">
              {(slotsByOffering[offering.id] ?? []).map((slot) => {
                const selected = ctx.scheduleChoices[offering.id]?.slot.slot_label === slot.slot_label;
                const conflicting = selected && conflictingSlotLabels.has(slot.slot_label);
                const startLabel = classStartLabel(slot.slot_start_date);
                return (
                  <button
                    key={slot.slot_label}
                    type="button"
                    className={`option-card${selected ? " selected" : ""}${conflicting ? " conflict" : ""}`}
                    onClick={() => chooseSlot(offering, slot)}
                  >
                    <span className="option-indicator" />
                    <span className="option-body">
                      <span className="option-title">
                        {slot.day} • {slot.time}
                      </span>
                      <span className="option-subtitle-row">
                        {startLabel && (
                          <span className={`option-badge ${classStartBadgeClass(slot.slot_start_date)}`}>{startLabel}</span>
                        )}
                        <span className="option-subtitle">
                          {slot.teacher}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}

      {hasScheduleConflict && (
        <p className="error-text">
          Jadwal yang dipilih saling bentrok. Pilih jadwal yang tidak bertabrakan untuk melanjutkan.
        </p>
      )}

      {!showPricing && (
        <button
          type="button"
          className="btn-primary page-footer-button"
          disabled={!allSlotsChosen || hasScheduleConflict}
          onClick={handleLihatHarga}
        >
          Lihat harga
        </button>
      )}

      {showPricing && (
        <>
          <h3 className="subsection-title">Tenor pembayaran</h3>
          {previewLoading && <LoadingIndicator label="Menghitung harga..." />}
          {previewError && <p className="error-text">Gagal menghitung harga: {previewError}</p>}

          <div className="option-list">
            {ctx.tenorPreview?.monthly && (
              <button
                type="button"
                className={`option-card${ctx.chosenTenor === "monthly" ? " selected" : ""}`}
                onClick={() => ctx.setChosenTenor("monthly")}
              >
                <span className="option-indicator" />
                <span className="option-body">
                  <span className="option-title">Per bulan</span>
                  <span className="option-subtitle">
                    Memperpanjang paket belajar hingga {formatDate(ctx.tenorPreview.monthly.period_end)}
                  </span>
                  {/* <span className="option-debug">
                    user_id: {ctx.userId} • finance_payment_type: {ctx.tenorPreview.monthly.finance_payment_type}
                  </span> */}
                </span>
                <span className="option-price">{formatIdr(ctx.tenorPreview.monthly.net_invoice)}</span>
              </button>
            )}

            {ctx.tenorPreview?.semesterly && (
              <button
                type="button"
                className={`option-card${ctx.chosenTenor === "semesterly" ? " selected" : ""}`}
                onClick={() => ctx.setChosenTenor("semesterly")}
              >
                <span className="option-indicator" />
                <span className="option-body">
                  <span className="option-title">Per semester</span>
                  <span className="option-subtitle">
                    Memperpanjang paket belajar hingga {formatDate(ctx.tenorPreview.semesterly.period_end)}
                  </span>
                  {/* <span className="option-debug">
                    user_id: {ctx.userId} • finance_payment_type: {ctx.tenorPreview.semesterly.finance_payment_type}
                  </span> */}
                </span>
                <span className="option-price">{formatIdr(ctx.tenorPreview.semesterly.net_invoice)}</span>
              </button>
            )}
          </div>

          <button
            type="button"
            className="btn-primary page-footer-button"
            disabled={!canConfirm}
            onClick={() => navigate(`/${ctx.userId}/add-subject/summary`)}
          >
            Konfirmasi Pembayaran
          </button>
        </>
      )}
    </div>
  );
}
