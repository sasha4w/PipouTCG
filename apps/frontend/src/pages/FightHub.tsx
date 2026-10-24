import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DECK_RULES } from "@pipou/shared";
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
          <h1 className="fh-title">{t("arena.title")}</h1>
          <p className="fh-subtitle">{t("arena.subtitle")}</p>
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
              <h2 className="fh-card__title">{t("arena.decksTitle")}</h2>
              <p className="fh-card__desc">{t("arena.decksDesc")}</p>
              <ul className="fh-card__features">
                <li>✦ {t("arena.decksF1", { max: DECK_RULES.MAX_CARDS })}</li>
                <li>
                  ✦ {t("arena.decksF2", { copies: DECK_RULES.MAX_COPIES })}
                </li>
                <li>✦ {t("arena.decksF3")}</li>
              </ul>
            </div>
            <div className="fh-card__cta">
              {t("arena.decksCta")} <span className="fh-arrow">→</span>
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
              <h2 className="fh-card__title">{t("arena.fightTitle")}</h2>
              <p className="fh-card__desc">{t("arena.fightDesc")}</p>
              <ul className="fh-card__features">
                <li>✦ {t("arena.fightF1")}</li>
                <li>✦ {t("arena.fightF2")}</li>
                <li>✦ {t("arena.fightF3")}</li>
              </ul>
            </div>
            <div className="fh-card__cta">
              {t("arena.fightCta")} <span className="fh-arrow">→</span>
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
