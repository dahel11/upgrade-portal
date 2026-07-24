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
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 20 }}>
        <button
          type="button"
          className="btn-primary"
          onClick={() => navigate(`/${userId}/renew/summary?tenor=monthly`)}
        >
          Per bulan
          <br />
          {formatIdr(finance.monthly_price)}
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={() => navigate(`/${userId}/renew/summary?tenor=semesterly`)}
        >
          Per semester
          <br />
          {formatIdr(finance.semesterly_price)}
          <span className="subtitle">(termasuk diskon 10%)</span>
        </button>
      </div>
    </div>
  );
}
