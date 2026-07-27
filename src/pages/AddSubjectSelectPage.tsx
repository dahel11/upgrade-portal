import { useNavigate, useOutletContext } from "react-router-dom";
import { TopBar } from "../components/TopBar";
import { AddSubjectIcon } from "../components/icons";
import { stripGradeSuffix } from "../lib/format";
import type { AddSubjectContextValue } from "./addSubjectContext";

export function AddSubjectSelectPage() {
  const ctx = useOutletContext<AddSubjectContextValue>();
  const navigate = useNavigate();

  function toggle(id: string) {
    ctx.setSelectedOfferingIds(
      ctx.selectedOfferingIds.includes(id)
        ? ctx.selectedOfferingIds.filter((existing) => existing !== id)
        : [...ctx.selectedOfferingIds, id],
    );
  }

  return (
    <div className="screen">
      <TopBar showBack />
      <h2 className="section-title">Mata pelajaran tersedia</h2>
      <p className="section-hint">Bisa memilih lebih dari satu</p>

      <div className="option-list">
        {ctx.availableOfferings.map((offering) => {
          const selected = ctx.selectedOfferingIds.includes(offering.id);
          return (
            <button
              key={offering.id}
              type="button"
              className={`option-card${selected ? " selected" : ""}`}
              onClick={() => toggle(offering.id)}
            >
              <span className="option-indicator checkbox">{selected ? "✓" : ""}</span>
              <span className="option-body">
                <span className="option-title">{stripGradeSuffix(offering.name)}</span>
              </span>
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
    </div>
  );
}
