import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { TopBar } from "../components/TopBar";
import { LoadingIndicator } from "../components/LoadingIndicator";
import { computeOfferingSelection, getAssumedCurrentTenure } from "../lib/offeringSelection";
import { resolveFinancePaymentType } from "../lib/financePaymentType";
import { fetchScheduleSlots, validateInvoice, type ScheduleSlot } from "../lib/edgeFunctions";
import { formatDate, formatIdr, stripGradeSuffix, subjectDisplayName } from "../lib/format";
import type { OfferingMapping } from "../types";
import type { AddSubjectContextValue, TenorPreview } from "./addSubjectContext";

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
        fetchScheduleSlots(ctx.finance.grade, scheduleSubjectOf(offering)).then((slots) => [offering.id, slots] as const),
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

  function handleLihatHarga() {
    if (!allSlotsChosen) return;
    setShowPricing(true);
    if (ctx.tenorPreview) return; // already fetched (e.g. user went back and forth)

    const { finalOfferingIds, programChanged, subjectAdded } = computeOfferingSelection(
      ctx.currentOfferings,
      selectedOfferings,
    );
    const currentTenure = getAssumedCurrentTenure();

    setPreviewLoading(true);
    Promise.all([
      validateInvoice({
        user_id: ctx.userId,
        finance_payment_type: resolveFinancePaymentType({
          programChanged,
          subjectAdded,
          tenureChanged: currentTenure !== "monthly",
        }),
        payment_category: "installment",
        offering_ids: finalOfferingIds,
        subscription_starts_in: "current_semester",
      }),
      validateInvoice({
        user_id: ctx.userId,
        finance_payment_type: resolveFinancePaymentType({
          programChanged,
          subjectAdded,
          tenureChanged: currentTenure !== "semesterly",
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

  const canConfirm = showPricing && ctx.tenorPreview && ctx.chosenTenor;

  return (
    <div className="screen">
      <TopBar showBack />
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
                return (
                  <button
                    key={slot.slot_label}
                    type="button"
                    className={`option-card${selected ? " selected" : ""}`}
                    onClick={() => chooseSlot(offering, slot)}
                  >
                    <span className="option-indicator" />
                    <span className="option-body">
                      <span className="option-title">
                        {slot.day} • {slot.time}
                      </span>
                      <span className="option-subtitle">
                        {slot.teacher} • Sisa kursi: {slot.seats_remaining}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}

      {!showPricing && (
        <button
          type="button"
          className="btn-primary page-footer-button"
          disabled={!allSlotsChosen}
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
