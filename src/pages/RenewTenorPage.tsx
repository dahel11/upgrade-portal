import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TopBar } from "../components/TopBar";
import { StatusScreen } from "../components/StatusScreen";
import { fetchRetentionFinance } from "../lib/data";
import { formatIdr } from "../lib/format";
import type { RetentionFinance } from "../types";

export function RenewTenorPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [finance, setFinance] = useState<RetentionFinance | null | "loading" | "error">("loading");

  useEffect(() => {
    if (!userId) return;
    fetchRetentionFinance(userId)
      .then((data) => setFinance(data))
      .catch(() => setFinance("error"));
  }, [userId]);

  if (finance === "loading") return <StatusScreen title="Memuat..." message="Mohon tunggu sebentar." />;
  if (finance === "error" || finance === null) {
    return <StatusScreen title="Terjadi kesalahan" message="Gagal memuat data paket. Silakan coba lagi." />;
  }

  return (
    <div className="screen">
      <TopBar showBack />
      <h2 className="section-title">Pilih tenor pembayaran</h2>
      <p className="section-hint">Perpanjangan untuk paket {finance.offering_names}</p>

      <div className="option-list">
        <button
          type="button"
          className="option-card"
          onClick={() => navigate(`/${userId}/renew/summary?tenor=monthly`)}
        >
          <span className="option-indicator" />
          <span className="option-body">
            <span className="option-title">Per bulan</span>
            <span className="option-subtitle">Ditagih setiap bulan</span>
          </span>
          <span className="option-price">{formatIdr(finance.monthly_price ?? 0)}</span>
        </button>

        <button
          type="button"
          className="option-card"
          onClick={() => navigate(`/${userId}/renew/summary?tenor=semesterly`)}
        >
          <span className="option-indicator" />
          <span className="option-body">
            <span className="option-title">
              Per semester
              <span className="option-badge">Hemat 10%</span>
            </span>
            <span className="option-subtitle">Ditagih sekali untuk satu semester</span>
          </span>
          <span className="option-price">{formatIdr(finance.semesterly_price ?? 0)}</span>
        </button>
      </div>
    </div>
  );
}
