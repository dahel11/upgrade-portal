import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { TopBar } from "../components/TopBar";
import { UnpaidTransactionModal } from "../components/UnpaidTransactionModal";
import { AddSubjectIcon, ChevronDownIcon, InfoIcon } from "../components/icons";
import { fetchPendingCheckoutTransactions } from "../lib/data";
import { stripGradeSuffix } from "../lib/format";
import { isFrequencyUpgrade } from "../lib/offeringSelection";
import type { AddSubjectContextValue } from "./addSubjectContext";

export function AddSubjectSelectPage() {
  const ctx = useOutletContext<AddSubjectContextValue>();
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);
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

    setExpandedId((current) => {
      if (nowSelected) return id;
      return current === id ? null : current;
    });
  }

  function toggleInfo(id: string) {
    setExpandedId((current) => (current === id ? null : id));
  }

  return (
    <div className="screen">
      <TopBar showBack backTo={`/${ctx.userId}`} />
      <h2 className="section-title">Mata pelajaran tersedia</h2>
      <p className="section-hint">Bisa memilih lebih dari satu</p>

      <div className="option-list">
        {ctx.availableOfferings.map((offering) => {
          const selected = ctx.selectedOfferingIds.includes(offering.id);
          const expanded = expandedId === offering.id;
          const upgrade = isFrequencyUpgrade(offering, ctx.currentOfferings);
          return (
            <div key={offering.id} className={`option-card option-card-expandable${selected ? " selected" : ""}`}>
              <div className="option-card-row">
                <button type="button" className="option-card-main" onClick={() => toggle(offering.id)}>
                  <span className="option-indicator checkbox">{selected ? "✓" : ""}</span>
                  <span className="option-body">
                    <span className="option-title">{offering.name}</span>
                    {upgrade && (
                      <span className="option-badge option-badge-warning option-badge-block">
                        Teman-teman & guru akan berbeda
                      </span>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  className="option-info-toggle"
                  aria-label={`Info tentang ${stripGradeSuffix(offering.name)}`}
                  aria-expanded={expanded}
                  onClick={() => toggleInfo(offering.id)}
                >
                  <InfoIcon />
                  <span className={`option-info-chevron${expanded ? " rotated" : ""}`}>
                    <ChevronDownIcon />
                  </span>
                </button>
              </div>
              {expanded && (
                <div className="option-info-panel">
                  {offering.description && <p>{offering.description}</p>}
                  {upgrade && (
                    // Temporarily placeholder text (2026-07-30, per direct request) — the pill
                    // badge above ("Teman-teman & guru akan berganti") stays as final copy, only
                    // this longer explanation is unreviewed draft copy for now.
                    <p className="option-info-warning">
                      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut
                      labore et dolore magna aliqua.
                    </p>
                  )}
                </div>
              )}
            </div>
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
