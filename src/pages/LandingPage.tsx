import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TopBar } from "../components/TopBar";
import { StatusScreen } from "../components/StatusScreen";
import { AddSubjectIcon, CalendarIcon, ChevronRightIcon, RenewIcon } from "../components/icons";
import { computeAvailableOfferings, resolveCurrentPackageSource, summarizePackageSource } from "../lib/data";
import { daysUntil, firstName, formatDate, splitOfferingNames } from "../lib/format";
import logo from "../assets/colearn-logo-blue.png";
import type { RetentionFinance, SemesterlyStudentTarget } from "../types";

type LoadState =
  | { kind: "loading" }
  | { kind: "not-found" }
  | { kind: "error"; message: string }
  | { kind: "ready"; finance: RetentionFinance }
  | { kind: "semesterly-upsell"; target: SemesterlyStudentTarget }
  | { kind: "semesterly-exhausted"; target: SemesterlyStudentTarget };

export function LandingPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    resolveCurrentPackageSource(userId)
      .then(async (source) => {
        if (cancelled) return;

        if (source.kind === "none") {
          setState({ kind: "not-found" });
          return;
        }

        if (source.kind === "semesterly-upsell") {
          const summary = summarizePackageSource(source)!;
          const { availableOfferings } = await computeAvailableOfferings(summary);
          if (cancelled) return;
          setState(
            availableOfferings.length === 0
              ? { kind: "semesterly-exhausted", target: source.target }
              : { kind: "semesterly-upsell", target: source.target },
          );
          return;
        }

        setState({ kind: "ready", finance: source.finance });
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

  if (state.kind === "semesterly-exhausted") {
    const { target } = state;
    return (
      <StatusScreen
        title="Terima kasih!"
        message={`${target.students_name} sudah mengikuti seluruh mata pelajaran yang tersedia untuk kelas ${target.grade} saat ini.`}
      />
    );
  }

  if (state.kind === "semesterly-upsell") {
    const { target } = state;
    return (
      <div className="screen">
        <TopBar />

        <div className="hero">
          <img src={logo} alt="CoLearn" className="hero-logo" />
          <h1 className="hero-greeting">Halo, {target.students_name}!</h1>
          <p className="hero-subtitle">
            Paket semesteran <strong>{firstName(target.students_name)}</strong> sedang aktif, saat yang pas untuk
            menambah mata pelajaran tambahan.
          </p>
        </div>

        <div className="info-card">
          <div className="info-row stacked">
            <span>Paket aktif saat ini</span>
            <span className="package-chips">
              {splitOfferingNames(target.offering_names).map((name) => (
                <span key={name} className="package-chip">
                  {name}
                </span>
              ))}
            </span>
          </div>
          <div className="info-row">
            <span>Kelas</span>
            <strong>{target.grade}</strong>
          </div>
        </div>

        <p className="section-label">Pilih salah satu untuk melanjutkan</p>

        <div className="action-list">
          <button type="button" className="action-card" disabled>
            <span className="action-icon">
              <RenewIcon />
            </span>
            <span className="action-text">
              <span className="action-title">Perpanjang paket saat ini</span>
              <span className="action-desc">Terima kasih sudah melakukan pembayaran per semester</span>
            </span>
          </button>

          <button type="button" className="action-card" onClick={() => navigate(`/${userId}/add-subject/select`)}>
            <span className="action-icon">
              <AddSubjectIcon />
            </span>
            <span className="action-text">
              <span className="action-title">Tambah mata pelajaran lain</span>
              <span className="action-desc">Makin semangat belajar dengan tambah subject baru</span>
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
        title="Belum ada langkah yang perlu dilakukan"
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
