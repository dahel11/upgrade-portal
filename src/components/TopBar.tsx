import { useNavigate } from "react-router-dom";

interface TopBarProps {
  showBack?: boolean;
  /** Explicit path to go back to. Preferred over relying on browser history (`navigate(-1)`),
   * which can feel unpredictable in this wizard flow once a user goes back and forth a few times
   * (query-param-only route changes, revisits, etc. all get pushed onto the same history stack). */
  backTo?: string;
  /** Custom back handler for pages with in-page wizard stages (e.g. collapse a stage instead of
   * leaving the route) — takes priority over `backTo` when provided. */
  onBack?: () => void;
}

const HELP_URL = "https://wa.me/6281119954075?text=Halo%20CoLearn%2C%20saya%20butuh%20bantuan%20terkait%20perpanjangan%20paket";

export function TopBar({ showBack = false, backTo, onBack }: TopBarProps) {
  const navigate = useNavigate();

  function handleBack() {
    if (onBack) return onBack();
    if (backTo) return navigate(backTo);
    navigate(-1);
  }

  return (
    <div className="top-bar">
      {showBack ? (
        <button type="button" className="link-button" onClick={handleBack}>
          Kembali
        </button>
      ) : (
        <span />
      )}
      <a href={HELP_URL} target="_blank" rel="noreferrer">
        Bantuan
      </a>
    </div>
  );
}
