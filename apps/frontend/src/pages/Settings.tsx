import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { authService } from "../services/auth.service";
import { useQueryClient } from "@tanstack/react-query";
import SoundSettings from "../components/SoundSettings";
import i18n from "../i18n";
import "./Settings.css";

const LANGS = [
  { code: "fr", label: "🇫🇷 Français" },
  { code: "en", label: "🇬🇧 English" },
  { code: "ko", label: "🇰🇷 한국어" },
];

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
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return (
    <div className="settings-page">
      <h1 className="settings-page__title">{t("settings.title")}</h1>

      <Section label={t("settings.audio")} defaultOpen>
        <SoundSettings />
      </Section>

      <Section label={t("settings.notifications")}>
        <NotifItem label={t("settings.notif_trades")} />
        <NotifItem label={t("settings.notif_boosters")} />
        <NotifItem label={t("settings.notif_news")} />
      </Section>

      <div className="settings-section">
        <div className="settings-lang">
          <span className="settings-lang__label">{t("settings.language")}</span>
          <select
            className="settings-lang__select"
            value={i18n.language.split("-")[0]}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
          >
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        className="settings-logout-btn"
        onClick={() => {
          authService.logout();
          queryClient.clear();
          navigate("/login");
        }}
      >
        {t("settings.logout")}
      </button>
    </div>
  );
};

export default Settings;
