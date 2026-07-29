import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TopBar } from "./TopBar";
import logo from "../assets/colearn-logo-blue.png";

const WAIT_SECONDS = 60;
const POLL_INTERVAL_MS = 4000;

interface PaymentWaitingScreenProps {
  userId: string;
  paymentUrl: string;
  onCancel: () => void;
  /** Caller-supplied "has this been paid yet?" check — the right source differs per flow:
   * add-subject invoices are tracked in `checkout_invoice_statuses` (keyed by the exact invoice_id
   * manual-checkout returns); the renew flow's pre-generated links never get a `manual-checkout`
   * invoice_id at all — confirmed absent from `checkout_invoice_statuses(_dev)` — so that flow
   * checks `retention_to_finances` (retention_status/invoice_status) instead. */
  checkPaid: () => Promise<boolean>;
  /** Where to send the user if nothing resolves within WAIT_SECONDS. Defaults to the transaction
   * history page — but that page only lists `checkout_transactions` rows (manual-checkout-created
   * invoices), so callers whose invoice never gets one (e.g. the renew flow's pre-generated links)
   * should point this at the landing page instead. */
  timeoutPath?: string;
}

/** Shown right after a payment tab is opened (in a *separate* tab — see callers for why
 * `window.open` must happen synchronously in the click handler, before any `await`). Polls via
 * `checkPaid` until it resolves true or `WAIT_SECONDS` runs out. If nothing resolves in time, hands
 * off to `timeoutPath` rather than claiming the payment failed — it may well still be processing
 * (see `checkPaid` doc — some sources sync far slower than this window). */
export function PaymentWaitingScreen({ userId, paymentUrl, onCancel, checkPaid, timeoutPath }: PaymentWaitingScreenProps) {
  const navigate = useNavigate();
  const [secondsLeft, setSecondsLeft] = useState(WAIT_SECONDS);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    if (paid) {
      navigate(`/${userId}`);
      return;
    }
    if (secondsLeft <= 0) {
      navigate(timeoutPath ?? `/${userId}/invoices`);
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, paid, userId, navigate, timeoutPath]);

  useEffect(() => {
    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const isPaid = await checkPaid();
        if (!cancelled && isPaid) setPaid(true);
      } catch (err) {
        console.error("[payment-waiting] status check failed:", err);
      }
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progress = secondsLeft / WAIT_SECONDS;

  return (
    <div className="screen">
      <TopBar />
      <div className="center-message">
        <img src={logo} alt="CoLearn" />
        <div className="countdown-ring" style={{ "--progress": progress } as React.CSSProperties}>
          <span className="countdown-number">{secondsLeft}</span>
        </div>
        <h2>Menunggu Pembayaran</h2>
        <p>
          Selesaikan pembayaran di tab yang baru saja terbuka. Halaman ini otomatis memperbarui begitu pembayaran
          kami terima.
        </p>
        <a href={paymentUrl} target="_blank" rel="noreferrer" className="link-button">
          Buka lagi halaman pembayaran
        </a>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Kembali
        </button>
      </div>
    </div>
  );
}
