import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { TopBar } from "../components/TopBar";
import { UnpaidTransactionModal } from "../components/UnpaidTransactionModal";
import { AddSubjectIcon } from "../components/icons";
import { fetchPendingCheckoutTransactions } from "../lib/data";
import { isFrequencyUpgrade } from "../lib/offeringSelection";
import type { AddSubjectContextValue } from "./addSubjectContext";

export function AddSubjectSelectPage() {
  const ctx = useOutletContext<AddSubjectContextValue>();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);
  const [showUnpaidModal, setShowUnpaidModal] = useState(false);

  // Warn upfront (before the user picks anything) if they already have an unpaid link out there —
  // doesn't block the flow, just makes generating another one a deliberate choice. Best-effort:
  // if the check itself fails, don't block the flow over it.
  useEffect(() => {
    let cancelled = false;
    fetchPendingCheckoutTransactions(ctx.userId)
      .then((transactions) => {
        if (cancelled || transactions.length === 0) return;
        setPendingCount(transactions.length);
        setShowUnpaidModal(true);
      })
      .catch((err) => console.error("[pending-transactions] failed to check:", err));
    return () => {
      cancelled = true;
    };
  }, [ctx.userId]);

  function toggle(id: string) {
    const nowSelected = !ctx.selectedOfferingIds.includes(id);
    ctx.setSelectedOfferingIds(
      nowSelected ? [...ctx.selectedOfferingIds, id] : ctx.selectedOfferingIds.filter((existing) => existing !== id),
    );

    // The offering set just changed, so any previously computed price preview no longer reflects
    // what's actually selected — manual-checkout re-derives price/offering_ids from that preview's
    // invoice_validation_id server-side, so a stale one would charge for the wrong offering set.
    ctx.setTenorPreview(null);
    ctx.setChosenTenor(null);
    if (!nowSelected) {
      ctx.setScheduleChoices(
        Object.fromEntries(Object.entries(ctx.scheduleChoices).filter(([offeringId]) => offeringId !== id)),
      );
    }
  }

  return (
    <div className="screen">
      <TopBar showBack backTo={`/${ctx.userId}`} />
      <h2 className="section-title">Mata pelajaran tersedia</h2>
      <p className="section-hint">Bisa memilih lebih dari satu</p>

      <div className="option-list">
        {ctx.availableOfferings.map((offering) => {
          const selected = ctx.selectedOfferingIds.includes(offering.id);
          const upgrade = isFrequencyUpgrade(offering, ctx.currentOfferings);
          return (
            <button
              key={offering.id}
              type="button"
              className={`option-card option-card-expandable${selected ? " selected" : ""}`}
              onClick={() => toggle(offering.id)}
            >
              <span className="option-card-row">
                <span className="option-indicator checkbox">{selected ? "✓" : ""}</span>
                <span className="option-body">
                  <span className="option-title">{offering.name}</span>
                  {upgrade && (
                    <span className="option-badge option-badge-warning option-badge-block">
                      Teman-teman & guru akan berbeda
                    </span>
                  )}
                </span>
              </span>
              {offering.description && (
                <span className="option-info-panel">
                  <span>{offering.description}</span>
                </span>
              )}
            </button>
          );
        })}
        {ctx.availableOfferings.length === 0 && (
          <p className="section-hint">Tidak ada mata pelajaran tambahan yang tersedia untuk kelas ini.</p>
        )}
      </div>

      <button
        type="button"
        className="btn-primary page-footer-button"
        disabled={ctx.selectedOfferingIds.length === 0}
        onClick={() => navigate(`/${ctx.userId}/add-subject/schedule`)}
      >
        <AddSubjectIcon /> Lihat jadwal
      </button>

      {showUnpaidModal && (
        <UnpaidTransactionModal
          userId={ctx.userId}
          count={pendingCount}
          onCancel={() => navigate(`/${ctx.userId}`)}
          onContinue={() => setShowUnpaidModal(false)}
        />
      )}
    </div>
  );
}
