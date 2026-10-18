import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { IconMap } from "../components/Icons";
import "./FightHub.css";

export default function FightHub() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="fh-root">
      {/* Background decoration */}
      <div className="fh-bg-orb fh-bg-orb--left" />
      <div className="fh-bg-orb fh-bg-orb--right" />

      <div className="fh-content">
        <div className="fh-header">
          <h1 className="fh-title">Arène</h1>
          <p className="fh-subtitle">
            Construis ton deck, affronte des adversaires, grimpe dans le
            classement.
          </p>
        </div>

        <div className="fh-cards">
          {/* ── Deck Builder ─────────────────────────────────────────── */}
          <button
            className="fh-card fh-card--decks"
            onClick={() => navigate("/decks")}
          >
            <div className="fh-card__glow" />
            <div className="fh-card__icon">🃏</div>
            <div className="fh-card__body">
              <h2 className="fh-card__title">Deck Builder</h2>
              <p className="fh-card__desc">
                Crée et gère tes decks. Choisis tes cartes, affine ta stratégie,
                prépare-toi au combat.
              </p>
              <ul className="fh-card__features">
                <li>✦ Jusqu'à 40 cartes par deck</li>
                <li>✦ Max 3 exemplaires par carte</li>
                <li>✦ Bibliothèque complète filtrable</li>
              </ul>
            </div>
            <div className="fh-card__cta">
              Gérer mes decks <span className="fh-arrow">→</span>
            </div>
          </button>

          {/* ── Combat ───────────────────────────────────────────────── */}
          <button
            className="fh-card fh-card--fight"
            onClick={() => navigate("/fight")}
          >
            <div className="fh-card__glow" />
            <div className="fh-card__icon">⚔️</div>
            <div className="fh-card__body">
              <h2 className="fh-card__title">Combat (WIP)</h2>
              <p className="fh-card__desc">
                Affronte un adversaire en 1v1 en temps réel. Dépense tes Primes,
                vole celles de l'ennemi, et remporte la victoire.
              </p>
              <ul className="fh-card__features">
                <li>✦ Fonction Match non fonctionnelle</li>
                <li>✦ Classement ELO en direct</li>
                <li>✦ Historique des matchs</li>
              </ul>
            </div>
            <div className="fh-card__cta">
              Rejoindre l'arène <span className="fh-arrow">→</span>
            </div>
          </button>
          {/* ── Aventure (PvE) ───────────────────────────────────────── */}
          <button
            className="fh-card fh-card--adventure"
            onClick={() => navigate("/adventure")}
          >
            <div className="fh-card__glow" />
            <div className="fh-card__icon">
              <IconMap size={44} />
            </div>
            <div className="fh-card__body">
              <h2 className="fh-card__title">{t("adventure.hub.title")}</h2>
              <p className="fh-card__desc">{t("adventure.hub.desc")}</p>
              <ul className="fh-card__features">
                <li>✦ {t("adventure.hub.f1")}</li>
                <li>✦ {t("adventure.hub.f2")}</li>
                <li>✦ {t("adventure.hub.f3")}</li>
              </ul>
            </div>
            <div className="fh-card__cta">
              {t("adventure.hub.cta")} <span className="fh-arrow">→</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
