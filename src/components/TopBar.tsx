import { useNavigate } from "react-router-dom";

interface TopBarProps {
  showBack?: boolean;
}

const HELP_URL = "https://wa.me/6281234567890?text=Halo%20CoLearn%2C%20saya%20butuh%20bantuan%20terkait%20perpanjangan%20paket";

export function TopBar({ showBack = false }: TopBarProps) {
  const navigate = useNavigate();

  return (
    <div className="top-bar">
      {showBack ? (
        <button type="button" className="link-button" onClick={() => navigate(-1)}>
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
