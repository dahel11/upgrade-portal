import { formatIdr } from "../lib/format";

export interface PaymentSummaryCardProps {
  studentName: string;
  grade: string;
  packageLabel: string;
  totalAmount: number;
  tenorLabel: string;
  periodLabel: string;
}

export function PaymentSummaryCard({
  studentName,
  grade,
  packageLabel,
  totalAmount,
  tenorLabel,
  periodLabel,
}: PaymentSummaryCardProps) {
  return (
    <div className="summary-card">
      <div className="summary-row">
        <span>Nama Murid</span>
        <span>{studentName}</span>
      </div>
      <div className="summary-row">
        <span>Kelas</span>
        <span>{grade}</span>
      </div>
      <div className="summary-row">
        <span>Paket Belajar</span>
        <span>{packageLabel}</span>
      </div>
      <div className="summary-row">
        <span>Tenor Bayar</span>
        <span>{tenorLabel}</span>
      </div>
      <div className="summary-row">
        <span>Periode</span>
        <span>{periodLabel}</span>
      </div>
      <div className="summary-total-row">
        <span className="summary-total-label">Total Bayar</span>
        <span className="summary-total-value">{formatIdr(totalAmount)}</span>
      </div>
    </div>
  );
}
