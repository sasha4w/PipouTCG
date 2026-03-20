import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../services/auth.service";
import { api } from "../api/api";
import "./Login.css";

type Mode = "login" | "register" | "forgot";

const Login = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false); // ← ajout
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const reset = (nextMode: Mode) => {
    setMode(nextMode);
    setError("");
    setSuccess("");
    setUsername("");
    setEmail("");
    setPassword("");
    setRememberMe(false); // ← reset aussi
  };

  const handleSubmit = async () => {
    setError("");
    setSuccess("");
    try {
      if (mode === "register") {
        await authService.register(username, email, password);
        setSuccess("Compte créé ! Tu peux te connecter 🎉");
        reset("login");
      } else if (mode === "login") {
        await authService.login(email, password, rememberMe); // ← ajout
        navigate("/");
      } else if (mode === "forgot") {
        await api.post("/auth/forgot-password", { email });
        setSuccess(
          "Si cet email existe, un lien de réinitialisation a été envoyé 📬",
        );
      }
    } catch (e: any) {
      if (e.response?.status === 409) {
        setError("Email déjà utilisé");
      } else if (e.response?.status === 401) {
        setError("Email ou mot de passe incorrect");
      } else {
        setError("Une erreur est survenue");
      }
    }
  };

  const titles: Record<Mode, string> = {
    login: "Content de te revoir !",
    register: "Crée ton compte et commence à collectionner !",
    forgot: "Réinitialise ton mot de passe",
  };

  const btnLabels: Record<Mode, string> = {
    login: "Se connecter",
    register: "Créer mon compte",
    forgot: "Envoyer le lien",
  };

  return (
    <div className="login-page">
      <div className="login-bubble login-bubble--1" />
      <div className="login-bubble login-bubble--2" />
      <div className="login-bubble login-bubble--3" />

      <div className="login-card">
        <div className="login-header">
          <h1 className="login-logo">Card &amp; Collect</h1>
          <p className="login-subtitle">{titles[mode]}</p>
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
              <label className="login-label">Pseudo</label>
              <input
                className="login-input"
                type="text"
                placeholder="Ton pseudo de joueur"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          )}

          <div className="login-field">
            <label className="login-label">Email</label>
            <input
              className="login-input"
              type="email"
              placeholder="ton@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {mode !== "forgot" && (
            <div className="login-field">
              <div className="login-label-row">
                <label className="login-label">Mot de passe</label>
                {mode === "login" && (
                  <span
                    className="login-forgot-link"
                    onClick={() => reset("forgot")}
                  >
                    Mot de passe oublié ?
                  </span>
                )}
              </div>
              <input
                className="login-input"
                type="password"
                placeholder="6 caractères minimum"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>
          )}

          {/* ← Checkbox rester connecté, visible uniquement en mode login */}
          {mode === "login" && (
            <div className="login-field login-field--checkbox">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <label htmlFor="rememberMe" className="login-label">
                Rester connecté
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
              <span className="login-switch__text">Tu t'en souviens ?</span>
              <span
                className="login-switch__link"
                onClick={() => reset("login")}
              >
                Se connecter
              </span>
            </>
          ) : mode === "login" ? (
            <>
              <span className="login-switch__text">Pas encore de compte ?</span>
              <span
                className="login-switch__link"
                onClick={() => reset("register")}
              >
                S'inscrire
              </span>
            </>
          ) : (
            <>
              <span className="login-switch__text">Déjà un compte ?</span>
              <span
                className="login-switch__link"
                onClick={() => reset("login")}
              >
                Se connecter
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
