import { useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { TopBar } from "../components/TopBar";
import { PaymentSummaryCard } from "../components/PaymentSummaryCard";
import { manualCheckout } from "../lib/edgeFunctions";
import { formatPeriod, stripGradeSuffix } from "../lib/format";
import type { AddSubjectContextValue } from "./addSubjectContext";

export function AddSubjectSummaryPage() {
  const ctx = useOutletContext<AddSubjectContextValue>();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = ctx.chosenTenor ? ctx.tenorPreview?.[ctx.chosenTenor] : null;

  // Full name minus grade suffix (keeps frequency, e.g. "Matematika 2x/Minggu") — subject alone
  // would lose that detail, which matters here since this is the final confirmation screen.
  const packageLabel = useMemo(
    () =>
      ctx.availableOfferings
        .filter((o) => ctx.selectedOfferingIds.includes(o.id))
        .map((o) => stripGradeSuffix(o.name))
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
      <TopBar showBack backTo={`/${ctx.userId}/add-subject/schedule`} />
      <h2 className="section-title">Ringkasan Pembayaran</h2>

      <PaymentSummaryCard
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

      {error && <p className="error-text">{error}</p>}

      <div className="button-row">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => navigate(`/${ctx.userId}/add-subject/schedule`)}
        >
          Kembali
        </button>
        <button type="button" className="btn-primary" disabled={submitting} onClick={handleBayar}>
          {submitting ? "Memproses..." : "Bayar"}
        </button>
      </div>
    </div>
  );
}
