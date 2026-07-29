import { Link } from "react-router-dom";

interface UnpaidTransactionModalProps {
  userId: string;
  count: number;
  onCancel: () => void;
  onContinue: () => void;
}

/** Warns before letting the user generate another checkout while an earlier one is still unpaid —
 * doesn't block them (see `fetchPendingCheckoutTransactions` for what counts as "unpaid"), just
 * makes sure it's a deliberate choice (e.g. correcting a mistaken earlier pick), not an accident. */
export function UnpaidTransactionModal({ userId, count, onCancel, onContinue }: UnpaidTransactionModalProps) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <h3 className="modal-title">Masih ada transaksi yang belum dibayar</h3>
        <p className="modal-message">
          Kamu punya {count} link pembayaran yang belum diselesaikan. Pastikan sudah membayar salah satu sebelum
          membuat pengajuan baru, supaya tidak menumpuk transaksi ganda.
        </p>
        <Link to={`/${userId}/invoices`} className="modal-link">
          Lihat daftar transaksi
        </Link>
        <div className="button-row">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Kembali
          </button>
          <button type="button" className="btn-primary" onClick={onContinue}>
            Tetap Lanjutkan
          </button>
        </div>
      </div>
    </div>
  );
}
