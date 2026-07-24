import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TopBar } from "../components/TopBar";
import { StatusScreen } from "../components/StatusScreen";
import { fetchRetentionFinance } from "../lib/data";
import type { RetentionFinance } from "../types";

type LoadState =
  | { kind: "loading" }
  | { kind: "not-found" }
  | { kind: "error"; message: string }
  | { kind: "ready"; finance: RetentionFinance };

export function LandingPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    fetchRetentionFinance(userId)
      .then((finance) => {
        if (cancelled) return;
        setState(finance ? { kind: "ready", finance } : { kind: "not-found" });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setState({ kind: "error", message: err.message });
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (state.kind === "loading") {
    return <StatusScreen title="Memuat..." message="Mohon tunggu sebentar." />;
  }

  if (state.kind === "not-found") {
    return (
      <StatusScreen
        title="Data tidak ditemukan"
        message="Link yang Anda buka tidak valid. Silakan hubungi CoLearn melalui WhatsApp untuk bantuan."
      />
    );
  }

  if (state.kind === "error") {
    return <StatusScreen title="Terjadi kesalahan" message={state.message} />;
  }

  const { finance } = state;
  const isRetentionActive = finance.retention_status === "active" && finance.invoice_status === "active";
  const isPaid = finance.retention_status === "completed" && finance.invoice_status === "paid";

  if (isPaid) {
    return (
      <StatusScreen
        title="Terima kasih!"
        message={`Pembayaran ${finance.user_name} untuk periode ini sudah kami terima. Sampai jumpa di periode retensi berikutnya.`}
      />
    );
  }

  if (!isRetentionActive) {
    return (
      <StatusScreen
        title="Belum ada aksi yang diperlukan"
        message="Saat ini tidak ada penawaran perpanjangan yang aktif untuk akun ini. Silakan hubungi CoLearn melalui WhatsApp bila ada pertanyaan."
      />
    );
  }

  return (
    <div className="screen">
      <TopBar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 20 }}>
        <button type="button" className="btn-primary" onClick={() => navigate(`/${userId}/renew/tenor`)}>
          Perpanjang
          <br />
          paket saat ini
          <span className="subtitle">{finance.offering_names}</span>
        </button>
        <button type="button" className="btn-primary" onClick={() => navigate(`/${userId}/add-subject/select`)}>
          Tambah mata
          <br />
          pelajaran lain
        </button>
      </div>
    </div>
  );
}
