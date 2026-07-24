import { useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { TopBar } from "../components/TopBar";
import { PaymentSummaryTable } from "../components/PaymentSummaryTable";
import { manualCheckout } from "../lib/edgeFunctions";
import { formatPeriod, subjectDisplayName } from "../lib/format";
import type { AddSubjectContextValue } from "./addSubjectContext";

export function AddSubjectSummaryPage() {
  const ctx = useOutletContext<AddSubjectContextValue>();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = ctx.chosenTenor ? ctx.tenorPreview?.[ctx.chosenTenor] : null;

  const packageLabel = useMemo(
    () =>
      ctx.availableOfferings
        .filter((o) => ctx.selectedOfferingIds.includes(o.id))
        .map((o) => subjectDisplayName(o.name))
        .join(", "),
    [ctx.availableOfferings, ctx.selectedOfferingIds],
  );

  if (!preview || !ctx.chosenTenor) {
    navigate(`/${ctx.userId}/add-subject/schedule`);
    return null;
  }

  async function handleBayar() {
    setSubmitting(true);
    setError(null);
    try {
      const scheduleChoice = Object.fromEntries(
        Object.entries(ctx.scheduleChoices).map(([offeringId, choice]) => [
          offeringId,
          { offering_id: offeringId, slot_label: choice.slot.slot_label },
        ]),
      );
      const result = await manualCheckout({
        invoice_validation_id: preview!.invoice_validation_id,
        schedule_choice: scheduleChoice,
      });
      window.location.href = result.invoice_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memproses pembayaran.");
      setSubmitting(false);
    }
  }

  return (
    <div className="screen">
      <TopBar showBack />
      <h2 className="section-title">Ringkasan Pembayaran</h2>

      <PaymentSummaryTable
        studentName={ctx.finance.user_name}
        grade={ctx.finance.grade}
        packageLabel={packageLabel}
        totalAmount={preview.net_invoice}
        tenorLabel={ctx.chosenTenor === "monthly" ? "Per bulan" : "Per semester"}
        periodLabel={formatPeriod(preview.period_start, preview.period_end)}
      />

      <p className="summary-disclaimer">
        Dengan melanjutkan pembayaran, Anda menyetujui dan memahami bahwa paket berlangganan tidak dapat diuangkan
        kembali, dibatalkan, dan dipindahtangankan. Baca Syarat dan Ketentuan CoLearn di colearn.id/ketentuan-layanan
      </p>

      {error && <p className="section-hint" style={{ color: "#c0392b" }}>{error}</p>}

      <div className="button-row">
        <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => navigate(-1)}>
          Kembali
        </button>
        <button type="button" className="btn-primary" style={{ flex: 1 }} disabled={submitting} onClick={handleBayar}>
          {submitting ? "Memproses..." : "Bayar"}
        </button>
      </div>
    </div>
  );
}
