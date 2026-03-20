import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../services/auth.service";
import SoundSettings from "../components/SoundSettings";
import "./Settings.css";

interface SectionProps {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Section({ label, children, defaultOpen = false }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="settings-section">
      <div className="settings-section__header" onClick={() => setOpen(!open)}>
        <span className="settings-section__label">{label}</span>
        <span
          className={`settings-section__toggle${open ? " settings-section__toggle--open" : ""}`}
        >
          +
        </span>
      </div>
      {open && <div className="settings-section__body">{children}</div>}
    </div>
  );
}

function NotifItem({ label }: { label: string }) {
  const [enabled, setEnabled] = useState(true);
  return (
    <div className="settings-notif-item">
      <span>{label}</span>
      <label className="settings-toggle">
        <input
          type="checkbox"
          checked={enabled}
          onChange={() => setEnabled(!enabled)}
        />
        <span className="settings-toggle__track" />
        <span className="settings-toggle__thumb" />
      </label>
    </div>
  );
}

const Settings = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    authService.logout();
    navigate("/login");
  };

  return (
    <div className="settings-page">
      <h1 className="settings-page__title">Settings</h1>

      {/* Audio */}
      <Section label="Audio" defaultOpen>
        <SoundSettings />
      </Section>

      {/* Notifications */}
      <Section label="Notifications">
        <NotifItem label="Trades Status" />
        <NotifItem label="Booster stock Status" />
        <NotifItem label="News" />
      </Section>

      {/* Langue */}
      <div className="settings-section">
        <div className="settings-lang">
          <span className="settings-lang__label">Langue</span>
          <select className="settings-lang__select">
            <option value="fr">🇫🇷 Français</option>
            <option value="en">🇬🇧 English</option>
          </select>
        </div>
      </div>

      {/* Déconnexion */}
      <button className="settings-logout-btn" onClick={handleLogout}>
        Se déconnecter
      </button>
    </div>
  );
};

export default Settings;
