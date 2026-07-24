import { formatIdr } from "../lib/format";

export interface PaymentSummaryTableProps {
  studentName: string;
  grade: string;
  packageLabel: string;
  totalAmount: number;
  tenorLabel: string;
  periodLabel: string;
}

export function PaymentSummaryTable({
  studentName,
  grade,
  packageLabel,
  totalAmount,
  tenorLabel,
  periodLabel,
}: PaymentSummaryTableProps) {
  return (
    <table className="summary-table">
      <tbody>
        <tr>
          <td>Nama Murid</td>
          <td>:</td>
          <td>{studentName}</td>
        </tr>
        <tr>
          <td>Kelas</td>
          <td>:</td>
          <td>{grade}</td>
        </tr>
        <tr>
          <td>Paket Belajar</td>
          <td>:</td>
          <td>{packageLabel}</td>
        </tr>
        <tr>
          <td>Total Bayar</td>
          <td>:</td>
          <td>{formatIdr(totalAmount)}</td>
        </tr>
        <tr>
          <td>Tenor Bayar</td>
          <td>:</td>
          <td>{tenorLabel}</td>
        </tr>
        <tr>
          <td>Periode</td>
          <td>:</td>
          <td>{periodLabel}</td>
        </tr>
      </tbody>
    </table>
  );
}
