import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/api";
import "./Login.css";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async () => {
    setError("");
    setSuccess("");
    if (password.length < 6) {
      setError(t("login.err_too_short"));
      return;
    }
    if (password !== confirm) {
      setError(t("login.err_mismatch"));
      return;
    }
    try {
      await api.post("/auth/reset-password", { token, newPassword: password });
      setSuccess(t("login.success_updated"));
      setTimeout(() => navigate("/login"), 2000);
    } catch {
      setError(t("login.err_invalid_token"));
    }
  };

  return (
    <div className="login-page">
      <div className="login-bubble login-bubble--1" />
      <div className="login-bubble login-bubble--2" />
      <div className="login-bubble login-bubble--3" />
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-logo">{t("login.title")}</h1>
          <p className="login-subtitle">{t("login.subtitle_reset")}</p>
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
          <div className="login-field">
            <label className="login-label">{t("login.new_password")}</label>
            <input
              className="login-input"
              type="password"
              placeholder={t("login.password_placeholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="login-field">
            <label className="login-label">{t("login.confirm_password")}</label>
            <input
              className="login-input"
              type="password"
              placeholder={t("login.confirm_placeholder")}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>
          <button className="login-btn" onClick={handleSubmit}>
            {t("login.btn_reset")}
          </button>
        </div>
        <div className="login-switch">
          <span className="login-switch__text">{t("login.remember_it")}</span>
          <span
            className="login-switch__link"
            onClick={() => navigate("/login")}
          >
            {t("login.sign_in")}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
