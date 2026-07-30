import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { TopBar } from "../components/TopBar";
import { StatusScreen } from "../components/StatusScreen";
import { PaymentSummaryCard } from "../components/PaymentSummaryCard";
import { PaymentWaitingScreen } from "../components/PaymentWaitingScreen";
import { derivePeriodFromPayment, fetchRetentionFinance, fetchRetentionPayments, findRenewalPaymentLink } from "../lib/data";
import { formatPeriod } from "../lib/format";
import type { RetentionFinance, RetentionPayment, Tenor } from "../types";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; finance: RetentionFinance; payment: RetentionPayment };

export function RenewSummaryPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenor = (searchParams.get("tenor") as Tenor) ?? "monthly";
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    Promise.all([fetchRetentionFinance(userId), fetchRetentionPayments(userId)])
      .then(([finance, payments]) => {
        if (cancelled) return;
        if (!finance) {
          setState({ kind: "error", message: "Data paket tidak ditemukan." });
          return;
        }
        const payment = findRenewalPaymentLink(payments, tenor);
        if (!payment) {
          setState({ kind: "error", message: "Link pembayaran untuk tenor ini belum tersedia. Silakan hubungi CoLearn." });
          return;
        }
        setState({ kind: "ready", finance, payment });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setState({ kind: "error", message: err.message });
      });

    return () => {
      cancelled = true;
    };
  }, [userId, tenor]);

  if (state.kind === "loading") return <StatusScreen title="Memuat..." message="Mohon tunggu sebentar." />;
  if (state.kind === "error") return <StatusScreen title="Terjadi kesalahan" message={state.message} />;

  const { finance, payment } = state;

  if (waiting) {
    return (
      <PaymentWaitingScreen
        userId={userId!}
        paymentUrl={payment.invoice_url}
        // No checkout_transactions row exists for this pre-generated link (only manual-checkout
        // creates one), so /invoices wouldn't show it — send to the landing page instead.
        timeoutPath={`/${userId}`}
        // This pre-generated link's payment.id never shows up in checkout_invoice_statuses(_dev)
        // (confirmed by testing) — it's outside manual-checkout's tracking entirely, so the only
        // real signal is retention_to_finances, the same source LandingPage's "Terima kasih!"
        // screen already relies on for "has this student retained".
        checkPaid={async () => {
          const updated = await fetchRetentionFinance(userId!);
          return updated?.retention_status === "completed" && updated?.invoice_status === "paid";
        }}
      />
    );
  }

  const period = derivePeriodFromPayment(payment);
  // `payment.net_invoice` (synced from the payment link's own recorded amount) is preferred since
  // it reflects the exact invoice being redirected to, but has been observed 0/null for some
  // accounts (sync/data gap) — retention_to_finances' monthly_price/semesterly_price is already
  // proven reliable (it's what the previous tenor-choice screen showed), so fall back to that
  // rather than ever displaying Rp0.
  const fallbackAmount = tenor === "monthly" ? finance.monthly_price : finance.semesterly_price;
  const totalAmount = payment.net_invoice || fallbackAmount || 0;

  return (
    <div className="screen">
      <TopBar showBack backTo={`/${userId}/renew/tenor`} />
      <h2 className="section-title">Ringkasan Pembayaran</h2>

      <PaymentSummaryCard
        studentName={finance.user_name}
        grade={finance.grade}
        packageLabel={finance.offering_names}
        totalAmount={totalAmount}
        tenorLabel={tenor === "monthly" ? "Per bulan" : "Per semester"}
        periodLabel={formatPeriod(period.start, period.end)}
      />

      <p className="summary-disclaimer">
        Dengan melanjutkan pembayaran, Anda menyetujui dan memahami bahwa paket berlangganan tidak dapat diuangkan
        kembali, dibatalkan, dan dipindahtangankan. Baca Syarat dan Ketentuan CoLearn di colearn.id/ketentuan-layanan
      </p>

      <div className="button-row">
        <button type="button" className="btn-secondary" onClick={() => navigate(`/${userId}/renew/tenor`)}>
          Kembali
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            // No async call needed here (invoice_url is already known) — safe to open directly in
            // the click handler, no popup-blocker risk.
            window.open(payment.invoice_url, "_blank", "noopener,noreferrer");
            setWaiting(true);
          }}
        >
          Bayar
        </button>
      </div>
    </div>
  );
}
