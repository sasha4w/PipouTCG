import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { authService } from "../services/auth.service";
import { api } from "../api/api";
import i18n from "../i18n";
import "./Login.css";

type Mode = "login" | "register" | "forgot";

const LANGS = [
  { code: "fr", flag: "🇫🇷" },
  { code: "en", flag: "🇬🇧" },
  { code: "ko", flag: "🇰🇷" },
];

const Login = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const reset = (nextMode: Mode) => {
    setMode(nextMode);
    setError("");
    setSuccess("");
    setUsername("");
    setEmail("");
    setPassword("");
    setRememberMe(false);
  };

  const handleSubmit = async () => {
    setError("");
    setSuccess("");
    try {
      if (mode === "register") {
        await authService.register(username, email, password);
        setSuccess(t("login.success_created"));
        reset("login");
      } else if (mode === "login") {
        await authService.login(email, password, rememberMe);
        navigate("/");
      } else if (mode === "forgot") {
        await api.post("/auth/forgot-password", { email });
        setSuccess(t("login.success_reset"));
      }
    } catch (e: any) {
      if (e.response?.status === 409) setError(t("login.err_used"));
      else if (e.response?.status === 401) setError(t("login.err_credentials"));
      else setError(t("login.err_generic"));
    }
  };

  const subtitles: Record<Mode, string> = {
    login: t("login.subtitle_login"),
    register: t("login.subtitle_register"),
    forgot: t("login.subtitle_forgot"),
  };

  const btnLabels: Record<Mode, string> = {
    login: t("login.btn_login"),
    register: t("login.btn_register"),
    forgot: t("login.btn_forgot"),
  };

  return (
    <div className="login-page">
      <div className="login-bubble login-bubble--1" />
      <div className="login-bubble login-bubble--2" />
      <div className="login-bubble login-bubble--3" />

      <div className="login-card">
        {/* ── Sélecteur de langue ── */}
        <div className="login-lang-select">
          {LANGS.map((lang) => (
            <button
              key={lang.code}
              className={`login-lang-btn${i18n.language.startsWith(lang.code) ? " login-lang-btn--active" : ""}`}
              onClick={() => i18n.changeLanguage(lang.code)}
            >
              {lang.flag}
            </button>
          ))}
        </div>

        <div className="login-header">
          <h1 className="login-logo">{t("login.title")}</h1>
          <p className="login-subtitle">{subtitles[mode]}</p>
        </div>

        {error && (
          <div className="login-message login-message--error">
            <span>⚠</span> {error}
          </div>
        )}
        {success && (
          <div className="login-message login-message--success">
            <span>✓</span> {success}
          </div>
        )}

        <div className="login-form">
          {mode === "register" && (
            <div className="login-field">
              <label className="login-label">{t("login.username")}</label>
              <input
                className="login-input"
                type="text"
                placeholder={t("login.username_placeholder")}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          )}

          <div className="login-field">
            <label className="login-label">{t("login.email")}</label>
            <input
              className="login-input"
              type="email"
              placeholder={t("login.email_placeholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {mode !== "forgot" && (
            <div className="login-field">
              <div className="login-label-row">
                <label className="login-label">{t("login.password")}</label>
                {mode === "login" && (
                  <span
                    className="login-forgot-link"
                    onClick={() => reset("forgot")}
                  >
                    {t("login.forgot_link")}
                  </span>
                )}
              </div>
              <input
                className="login-input"
                type="password"
                placeholder={t("login.password_placeholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>
          )}

          {mode === "login" && (
            <div className="login-field login-field--checkbox">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <label htmlFor="rememberMe" className="login-label">
                {t("login.remember")}
              </label>
            </div>
          )}

          <button className="login-btn" onClick={handleSubmit}>
            {btnLabels[mode]}
          </button>
        </div>

        <div className="login-switch">
          {mode === "forgot" ? (
            <>
              <span className="login-switch__text">
                {t("login.remember_it")}
              </span>
              <span
                className="login-switch__link"
                onClick={() => reset("login")}
              >
                {t("login.sign_in")}
              </span>
            </>
          ) : mode === "login" ? (
            <>
              <span className="login-switch__text">
                {t("login.no_account")}
              </span>
              <span
                className="login-switch__link"
                onClick={() => reset("register")}
              >
                {t("login.sign_up")}
              </span>
            </>
          ) : (
            <>
              <span className="login-switch__text">
                {t("login.has_account")}
              </span>
              <span
                className="login-switch__link"
                onClick={() => reset("login")}
              >
                {t("login.sign_in")}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
