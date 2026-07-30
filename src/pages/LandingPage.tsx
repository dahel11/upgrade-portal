import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TopBar } from "../components/TopBar";
import { StatusScreen } from "../components/StatusScreen";
import { AddSubjectIcon, CalendarIcon, ChevronRightIcon, RenewIcon } from "../components/icons";
import { fetchRetentionFinance } from "../lib/data";
import { daysUntil, firstName, formatDate, splitOfferingNames } from "../lib/format";
import logo from "../assets/colearn-logo-blue.png";
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
        message={`Pembayaran ${finance.user_name} untuk periode ini sudah kami terima.`}
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

  const remaining = finance.due_date ? daysUntil(finance.due_date) : null;

  return (
    <div className="screen">
      <TopBar />

      <div className="hero">
        <img src={logo} alt="CoLearn" className="hero-logo" />
        <h1 className="hero-greeting">Halo, {finance.user_name}!</h1>
        <p className="hero-subtitle">
          Waktunya perpanjang paket belajar supaya <strong>{firstName(finance.user_name)}</strong> bisa terus belajar
          tanpa jeda.
        </p>
      </div>

      <div className="info-card">
        <div className="info-row stacked">
          <span>Paket saat ini</span>
          <span className="package-chips">
            {splitOfferingNames(finance.offering_names).map((name) => (
              <span key={name} className="package-chip">
                {name}
              </span>
            ))}
          </span>
        </div>
        <div className="info-row">
          <span>Kelas</span>
          <strong>{finance.grade}</strong>
        </div>
        {finance.due_date && (
          <div className="info-row">
            <span>Berakhir pada</span>
            <strong>
              <CalendarIcon /> {formatDate(finance.due_date)}
            </strong>
          </div>
        )}
      </div>

      {remaining !== null && remaining >= 0 && (
        <p className="hero-countdown">
          {remaining === 0 ? "Paket Anda berakhir hari ini" : `${remaining} hari lagi menuju masa perpanjangan`}
        </p>
      )}

      <p className="section-label">Pilih salah satu untuk melanjutkan</p>

      <div className="action-list">
        <button type="button" className="action-card" onClick={() => navigate(`/${userId}/renew/tenor`)}>
          <span className="action-icon">
            <RenewIcon />
          </span>
          <span className="action-text">
            <span className="action-title">Perpanjang paket saat ini</span>
            <span className="action-desc">{splitOfferingNames(finance.offering_names).join(" + ")}</span>
          </span>
          <span className="action-chevron">
            <ChevronRightIcon />
          </span>
        </button>

        <button type="button" className="action-card" onClick={() => navigate(`/${userId}/add-subject/select`)}>
          <span className="action-icon">
            <AddSubjectIcon />
          </span>
          <span className="action-text">
            <span className="action-title">Tambah mata pelajaran lain</span>
            <span className="action-desc">Tambah subjek baru atau tingkatkan frekuensi belajar</span>
          </span>
          <span className="action-chevron">
            <ChevronRightIcon />
          </span>
        </button>
      </div>

      <button type="button" className="link-button footer-link" onClick={() => navigate(`/${userId}/invoices`)}>
        Lihat riwayat transaksi
      </button>
    </div>
  );
}
