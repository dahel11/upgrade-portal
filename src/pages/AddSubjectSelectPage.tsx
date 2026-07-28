import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { TopBar } from "../components/TopBar";
import { AddSubjectIcon, ChevronDownIcon, InfoIcon } from "../components/icons";
import { stripGradeSuffix } from "../lib/format";
import { isFrequencyUpgrade } from "../lib/offeringSelection";
import { getSubjectInfo } from "../lib/subjectInfo";
import type { AddSubjectContextValue } from "./addSubjectContext";

export function AddSubjectSelectPage() {
  const ctx = useOutletContext<AddSubjectContextValue>();
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggle(id: string) {
    const nowSelected = !ctx.selectedOfferingIds.includes(id);
    ctx.setSelectedOfferingIds(
      nowSelected ? [...ctx.selectedOfferingIds, id] : ctx.selectedOfferingIds.filter((existing) => existing !== id),
    );
    // Selecting a subject auto-opens its info panel so the "what you'll learn" / class-change
    // details are seen right away, without an extra tap.
    if (nowSelected) setExpandedId(id);
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
                    <span className="option-title">{stripGradeSuffix(offering.name)}</span>
                    {upgrade && (
                      <span className="option-badge option-badge-warning option-badge-block">
                        Teman-teman & guru akan berganti
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
                  <p>{getSubjectInfo(offering)}</p>
                  {upgrade && (
                    <p className="option-info-warning">
                      Teman-teman & guru akan berganti — karena ini upgrade frekuensi dari mata pelajaran yang sudah
                      kamu ikuti, jadwal kelas akan disesuaikan sehingga teman sekelas dan guru pengampu bisa berbeda
                      dari kelas kamu saat ini.
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
    </div>
  );
}
