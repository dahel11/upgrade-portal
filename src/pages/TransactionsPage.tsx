import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { TopBar } from "../components/TopBar";
import { LoadingIndicator } from "../components/LoadingIndicator";
import { fetchCheckoutTransactions, fetchInvoiceStatuses } from "../lib/data";
import { describeInvoiceStatus, formatDate, formatIdr, invoiceStatusBadgeClass } from "../lib/format";
import type { CheckoutTransaction, InvoiceStatus } from "../types";

type TransactionRow = CheckoutTransaction & { statusInfo: InvoiceStatus | undefined };

type LoadState = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; rows: TransactionRow[] };

export function TransactionsPage() {
  const { userId } = useParams<{ userId: string }>();
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    fetchCheckoutTransactions(userId)
      .then(async (transactions) => {
        const statuses = await fetchInvoiceStatuses(transactions.map((t) => t.invoice_id));
        if (cancelled) return;

        const statusByInvoiceId = new Map(statuses.map((s) => [s.invoice_id, s]));
        const rows = transactions.map((t) => ({ ...t, statusInfo: statusByInvoiceId.get(t.invoice_id) }));
        setState({ kind: "ready", rows });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setState({ kind: "error", message: err.message });
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <div className="screen">
      <TopBar showBack backTo={`/${userId}`} />
      <h2 className="section-title">Riwayat Transaksi</h2>
      <p className="section-hint">Daftar link pembayaran yang pernah kamu buat, beserta statusnya.</p>

      {state.kind === "loading" && <LoadingIndicator label="Memuat riwayat transaksi..." />}
      {state.kind === "error" && <p className="error-text">Gagal memuat riwayat: {state.message}</p>}

      {state.kind === "ready" && state.rows.length === 0 && (
        <p className="section-hint">Belum ada transaksi yang tercatat.</p>
      )}

      {state.kind === "ready" && (
        <div className="option-list">
          {state.rows.map((row) => {
            const status = row.statusInfo?.status;
            return (
              <div key={row.id} className="transaction-card">
                <div className="transaction-card-row">
                  <span className="option-title">{formatDate(row.created_at)}</span>
                  <span className={`option-badge ${invoiceStatusBadgeClass(status)}`}>
                    {describeInvoiceStatus(status)}
                  </span>
                </div>
                {row.statusInfo?.total_amount != null && (
                  <span className="option-subtitle">{formatIdr(row.statusInfo.total_amount)}</span>
                )}
                {status === "pending" && (
                  <a href={row.invoice_url} target="_blank" rel="noreferrer" className="link-button">
                    Lanjutkan pembayaran
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
