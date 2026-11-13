import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { IconBulb, IconCheck } from "../../components/Icons";
import { PUZZLE_PATH } from "./puzzleView";
import { useTodayPuzzle } from "./useTodayPuzzle";

/** 4e carte de l'arène : le défi du jour. */
export default function PuzzleCard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data } = useTodayPuzzle();

  const available = Boolean(data?.puzzle);

  const renderBadge = () => {
    if (!data) return null;
    if (!available) {
      return (
        <span className="fh-badge fh-badge--none">{t("puzzle.hub.none")}</span>
      );
    }
    if (data.solved) {
      return (
        <span className="fh-badge fh-badge--done">
          <IconCheck size={13} />
          {t("puzzle.hub.done")}
        </span>
      );
    }
    return (
      <span className="fh-badge fh-badge--todo">{t("puzzle.hub.todo")}</span>
    );
  };

  return (
    <button
      type="button"
      className="fh-card fh-card--puzzle"
      // Aucun défi publié : carte grisée, non cliquable
      disabled={Boolean(data) && !available}
      onClick={() => navigate(PUZZLE_PATH)}
    >
      <div className="fh-card__glow" />
      <div className="fh-card__icon">
        <IconBulb size={44} />
      </div>
      <div className="fh-card__body">
        <h2 className="fh-card__title">{t("puzzle.hub.title")}</h2>
        <p className="fh-card__desc">{t("puzzle.hub.desc")}</p>
        {data && (
          <ul className="fh-card__features">
            {available && (
              <li>✦ {t("puzzle.hub.streak", { count: data.streak.current })}</li>
            )}
            <li>{renderBadge()}</li>
          </ul>
        )}
      </div>
      <div className="fh-card__cta">
        {t("puzzle.hub.cta")} <span className="fh-arrow">→</span>
      </div>
    </button>
  );
}
