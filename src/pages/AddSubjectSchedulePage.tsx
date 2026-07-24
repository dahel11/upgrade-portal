import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { TopBar } from "../components/TopBar";
import { computeOfferingSelection, getAssumedCurrentTenure } from "../lib/offeringSelection";
import { resolveFinancePaymentType } from "../lib/financePaymentType";
import { fetchScheduleSlots, validateInvoice, type ScheduleSlot } from "../lib/edgeFunctions";
import { formatDate, formatIdr, subjectDisplayName } from "../lib/format";
import type { AddSubjectContextValue, TenorPreview } from "./addSubjectContext";

export function AddSubjectSchedulePage() {
  const ctx = useOutletContext<AddSubjectContextValue>();
  const navigate = useNavigate();

  const selectedOfferings = useMemo(
    () => ctx.availableOfferings.filter((o) => ctx.selectedOfferingIds.includes(o.id)),
    [ctx.availableOfferings, ctx.selectedOfferingIds],
  );

  const [slotsByOffering, setSlotsByOffering] = useState<Record<string, ScheduleSlot[]>>({});
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (selectedOfferings.length === 0) {
      navigate(`/${ctx.userId}/add-subject/select`);
      return;
    }

    let cancelled = false;
    Promise.all(
      selectedOfferings.map((offering) =>
        fetchScheduleSlots(ctx.finance.grade, subjectDisplayName(offering.name)).then((slots) => [offering.id, slots] as const),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        setSlotsByOffering(Object.fromEntries(results));
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setSlotsError(err.message);
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

  useEffect(() => {
    if (!allSlotsChosen || ctx.tenorPreview) return;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSlotsChosen]);

  const canConfirm = allSlotsChosen && ctx.tenorPreview && ctx.chosenTenor;

  return (
    <div className="screen">
      <TopBar showBack />
      <h2 className="section-title">Mata pelajaran tersedia</h2>
      <p className="section-hint">Bisa memilih lebih dari satu</p>

      {selectedOfferings.map((offering) => (
        <div key={offering.id}>
          <h3 style={{ fontSize: 14, marginTop: 20 }}>Pilihan jadwal {subjectDisplayName(offering.name)} tersedia</h3>
          {slotsError && <p className="section-hint">Gagal memuat jadwal: {slotsError}</p>}
          {(slotsByOffering[offering.id] ?? []).map((slot) => {
            const selected = ctx.scheduleChoices[offering.id]?.slot.slot_label === slot.slot_label;
            return (
              <div
                key={slot.slot_label}
                className={`card${selected ? " selected" : ""}`}
                onClick={() => chooseSlot(offering, slot)}
              >
                <div className="card-title">
                  {slot.day} • {slot.time}
                </div>
                <div className="card-subtitle">
                  {slot.teacher}
                  <br />
                  Sisa kursi: {slot.seats_remaining}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {allSlotsChosen && (
        <>
          <h3 style={{ fontSize: 14, marginTop: 20 }}>Pilihan tenor pembayaran tersedia</h3>
          <p className="section-hint">Silakan pilih salah satu</p>

          {previewLoading && <p className="section-hint">Menghitung harga...</p>}
          {previewError && <p className="section-hint">Gagal menghitung harga: {previewError}</p>}

          {ctx.tenorPreview?.monthly && (
            <div
              className={`card${ctx.chosenTenor === "monthly" ? " selected" : ""}`}
              onClick={() => ctx.setChosenTenor("monthly")}
            >
              <div className="card-title">Per bulan sebesar {formatIdr(ctx.tenorPreview.monthly.net_invoice)}</div>
              <div className="card-subtitle">
                Jika dibayarkan, akan memperpanjang paket belajar hingga {formatDate(ctx.tenorPreview.monthly.period_end)}
              </div>
            </div>
          )}

          {ctx.tenorPreview?.semesterly && (
            <div
              className={`card${ctx.chosenTenor === "semesterly" ? " selected" : ""}`}
              onClick={() => ctx.setChosenTenor("semesterly")}
            >
              <div className="card-title">
                Per semester sebesar {formatIdr(ctx.tenorPreview.semesterly.net_invoice)}
              </div>
              <div className="card-subtitle">
                Jika dibayarkan, akan memperpanjang paket belajar hingga{" "}
                {formatDate(ctx.tenorPreview.semesterly.period_end)}
              </div>
            </div>
          )}
        </>
      )}

      <button
        type="button"
        className="btn-primary"
        style={{ marginTop: 24 }}
        disabled={!canConfirm}
        onClick={() => navigate(`/${ctx.userId}/add-subject/summary`)}
      >
        Konfirmasi Pembayaran
      </button>
    </div>
  );
}
