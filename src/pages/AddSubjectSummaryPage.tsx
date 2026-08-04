import { useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { TopBar } from "../components/TopBar";
import { PaymentSummaryCard } from "../components/PaymentSummaryCard";
import { PaymentWaitingScreen } from "../components/PaymentWaitingScreen";
import { fetchInvoiceStatuses } from "../lib/data";
import { manualCheckout } from "../lib/edgeFunctions";
import { formatPeriod, stripGradeSuffix } from "../lib/format";
import type { AddSubjectContextValue } from "./addSubjectContext";

export function AddSubjectSummaryPage() {
  const ctx = useOutletContext<AddSubjectContextValue>();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState<{ invoiceId: string; paymentUrl: string } | null>(null);

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

    // Must open synchronously here, before the `await` below — a tab opened after an async gap
    // loses the "direct user gesture" browsers require, and gets popup-blocked (Safari especially).
    const paymentTab = window.open("", "_blank");

    try {
      const scheduleChoice = Object.fromEntries(
        Object.entries(ctx.scheduleChoices).map(([offeringId, choice]) => [
          offeringId,
          {
            offering_id: offeringId,
            slot_label: choice.slot.slot_label,
            offering_name: choice.offeringName,
            day: choice.slot.day,
            time: choice.slot.time,
            teacher: choice.slot.teacher,
            slot_id: choice.slot.slot_id,
            slot_name: choice.slot.slot_name,
            slot: choice.slot,
          },
        ]),
      );
      const result = await manualCheckout({
        invoice_validation_id: preview!.invoice_validation_id,
        schedule_choice: scheduleChoice,
      });

      if (paymentTab) {
        paymentTab.location.href = result.invoice_url;
        setWaiting({ invoiceId: result.invoice_id, paymentUrl: result.invoice_url });
      } else {
        // Popup was blocked — fall back to same-tab navigation so the user isn't stuck.
        window.location.href = result.invoice_url;
      }
    } catch (err) {
      paymentTab?.close();
      setError(err instanceof Error ? err.message : "Gagal memproses pembayaran.");
      setSubmitting(false);
    }
  }

  if (waiting) {
    return (
      <PaymentWaitingScreen
        userId={ctx.userId}
        paymentUrl={waiting.paymentUrl}
        timeoutPath={`/${ctx.userId}/invoices`}
        checkPaid={async () => {
          const statuses = await fetchInvoiceStatuses([waiting.invoiceId]);
          return statuses[0]?.status === "paid";
        }}
      />
    );
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
