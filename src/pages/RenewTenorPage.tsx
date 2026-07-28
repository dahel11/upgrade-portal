import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TopBar } from "../components/TopBar";
import { StatusScreen } from "../components/StatusScreen";
import { fetchRetentionFinance, fetchRetentionPayments, findRenewalPaymentLink } from "../lib/data";
import { formatIdr } from "../lib/format";
import type { RetentionFinance, RetentionPayment } from "../types";

type LoadState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; finance: RetentionFinance; payments: RetentionPayment[] };

export function RenewTenorPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    Promise.all([fetchRetentionFinance(userId), fetchRetentionPayments(userId)])
      .then(([finance, payments]) => {
        if (cancelled) return;
        if (!finance) {
          setState({ kind: "error" });
          return;
        }
        setState({ kind: "ready", finance, payments });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ kind: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (state.kind === "loading") return <StatusScreen title="Memuat..." message="Mohon tunggu sebentar." />;
  if (state.kind === "error") {
    return <StatusScreen title="Terjadi kesalahan" message="Gagal memuat data paket. Silakan coba lagi." />;
  }

  const { finance, payments } = state;

  // A tenor is only choosable if its pre-generated payment link is still `pending` — an
  // `expired` (or missing) link can't be paid, so clicking through to the summary screen would
  // just dead-end. See retention_to_payments.status.
  const monthlyLink = findRenewalPaymentLink(payments, "monthly");
  const semesterlyLink = findRenewalPaymentLink(payments, "semesterly");
  const monthlyAvailable = monthlyLink?.status === "pending";
  const semesterlyAvailable = semesterlyLink?.status === "pending";

  return (
    <div className="screen">
      <TopBar showBack backTo={`/${userId}`} />
      <h2 className="section-title">Pilih tenor pembayaran</h2>
      <p className="section-hint">Perpanjangan untuk paket {finance.offering_names}</p>

      <div className="option-list">
        <button
          type="button"
          className="option-card"
          disabled={!monthlyAvailable}
          onClick={() => navigate(`/${userId}/renew/summary?tenor=monthly`)}
        >
          <span className="option-indicator" />
          <span className="option-body">
            <span className="option-title">Per bulan</span>
            <span className="option-subtitle">
              {monthlyAvailable ? "Ditagih setiap bulan" : "Link pembayaran sudah tidak aktif"}
            </span>
          </span>
          <span className="option-price">{formatIdr(finance.monthly_price ?? 0)}</span>
        </button>

        <button
          type="button"
          className="option-card"
          disabled={!semesterlyAvailable}
          onClick={() => navigate(`/${userId}/renew/summary?tenor=semesterly`)}
        >
          <span className="option-indicator" />
          <span className="option-body">
            <span className="option-title">
              Per semester
              <span className="option-badge">Hemat 10%</span>
            </span>
            <span className="option-subtitle">
              {semesterlyAvailable ? "Ditagih sekali untuk satu semester" : "Link pembayaran sudah tidak aktif"}
            </span>
          </span>
          <span className="option-price">{formatIdr(finance.semesterly_price ?? 0)}</span>
        </button>
      </div>

      {!monthlyAvailable && !semesterlyAvailable && (
        <p className="error-text">
          Tidak ada link pembayaran aktif untuk paket ini saat ini. Silakan hubungi CoLearn melalui WhatsApp.
        </p>
      )}
    </div>
  );
}
