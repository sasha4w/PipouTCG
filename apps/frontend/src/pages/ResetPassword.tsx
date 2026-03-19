import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/api";
import "./Login.css"; // réutilise les mêmes styles

const ResetPassword = () => {
  const navigate = useNavigate();
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
      setError("Le mot de passe doit faire au moins 6 caractères");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }
    try {
      await api.post("/auth/reset-password", { token, newPassword: password });
      setSuccess("Mot de passe mis à jour ! Redirection...");
      setTimeout(() => navigate("/login"), 2000);
    } catch {
      setError("Lien invalide ou expiré. Refais une demande.");
    }
  };

  return (
    <div className="login-page">
      <div className="login-bubble login-bubble--1" />
      <div className="login-bubble login-bubble--2" />
      <div className="login-bubble login-bubble--3" />

      <div className="login-card">
        <div className="login-header">
          <h1 className="login-logo">Card &amp; Collect</h1>
          <p className="login-subtitle">Choisis un nouveau mot de passe</p>
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
            <label className="login-label">Nouveau mot de passe</label>
            <input
              className="login-input"
              type="password"
              placeholder="6 caractères minimum"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="login-field">
            <label className="login-label">Confirmer</label>
            <input
              className="login-input"
              type="password"
              placeholder="Répète ton mot de passe"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>
          <button className="login-btn" onClick={handleSubmit}>
            Réinitialiser
          </button>
        </div>

        <div className="login-switch">
          <span className="login-switch__text">Tu t'en souviens ?</span>
          <span
            className="login-switch__link"
            onClick={() => navigate("/login")}
          >
            Se connecter
          </span>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
