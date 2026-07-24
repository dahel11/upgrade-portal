import { useNavigate, useOutletContext } from "react-router-dom";
import { TopBar } from "../components/TopBar";
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

      <div>
        {ctx.availableOfferings.map((offering) => (
          <label key={offering.id} className="checkbox-row">
            <input
              type="checkbox"
              checked={ctx.selectedOfferingIds.includes(offering.id)}
              onChange={() => toggle(offering.id)}
            />
            <span>{stripGradeSuffix(offering.name)}</span>
          </label>
        ))}
        {ctx.availableOfferings.length === 0 && (
          <p className="section-hint">Tidak ada mata pelajaran tambahan yang tersedia untuk kelas ini.</p>
        )}
      </div>

      <button
        type="button"
        className="btn-primary"
        style={{ marginTop: 24 }}
        disabled={ctx.selectedOfferingIds.length === 0}
        onClick={() => navigate(`/${ctx.userId}/add-subject/schedule`)}
      >
        Lihat harga dan jadwal
      </button>
    </div>
  );
}
