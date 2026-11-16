import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Loading from "../../components/Loading";
import {
  IconArrowLeft,
  IconCheck,
  IconGift,
  IconGold,
} from "../../components/Icons";
import { QUERY_KEYS } from "../../utils/querykeys";
import { apiErrorMessage } from "../../utils/errors";
import {
  PUZZLE_PLAY_PATH,
  countdown,
  objectiveText,
  streakDots,
} from "./puzzleView";
import { useTodayPuzzle } from "./useTodayPuzzle";
import "./Puzzle.css";

/** Fiche du défi du jour : objectif, récompense, série et lancement. */
export default function PuzzlePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useTodayPuzzle();
  const [now, setNow] = useState(() => Date.now());
  const nextResetAt = data?.nextResetAt;

  // Horloge d'une seconde ; à l'échéance, le défi du jour est rechargé
  useEffect(() => {
    if (!nextResetAt) return;
    let refreshed = false;
    const id = setInterval(() => {
      const current = Date.now();
      setNow(current);
      // Un seul rechargement par échéance, même si le serveur tarde à répondre
      if (!refreshed && current >= new Date(nextResetAt).getTime()) {
        refreshed = true;
        void queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.puzzleToday,
        });
      }
    }, 1000);
    return () => clearInterval(id);
  }, [nextResetAt, queryClient]);

  const puzzle = data?.puzzle ?? null;
  const objective = puzzle ? objectiveText(puzzle.objective) : null;

  return (
    <div className="pz-root">
      <header className="pz-top">
        <button
          type="button"
          className="pz-back"
          aria-label={t("puzzle.back_label")}
          onClick={() => navigate("/arena")}
        >
          <IconArrowLeft size={16} />
          {t("puzzle.back")}
        </button>
        <h1 className="pz-top__title">{t("puzzle.title")}</h1>
      </header>

      <div className="pz-body">
        {isLoading && <Loading message={t("puzzle.loading")} />}
        {error && (
          <p className="pz-msg">
            {apiErrorMessage(error) ?? t("puzzle.errors.load")}
          </p>
        )}
        {data && !puzzle && <p className="pz-msg">{t("puzzle.none_today")}</p>}

        {data && puzzle && objective && (
          <>
            <section className="pz-box pz-box--goal">
              <h2 className="pz-goal__title">{puzzle.title}</h2>
              {puzzle.description && (
                <p className="pz-goal__desc">{puzzle.description}</p>
              )}
              <p className="pz-goal__objective">
                {t(objective.key, objective.vars)}
              </p>
            </section>

            <section className="pz-box">
              <h3 className="pz-box__label">{t("puzzle.reward.title")}</h3>
              <div className="pz-rewards">
                <div className="pz-reward pz-reward--gold">
                  <IconGold size={18} />
                  <strong>{puzzle.rewardGold}</strong>
                </div>
                <div className="pz-reward pz-reward--xp">
                  <strong>{puzzle.rewardXp}</strong>
                  <span>{t("puzzle.reward.xp")}</span>
                </div>
              </div>
            </section>

            <section className="pz-box">
              <h3 className="pz-box__label">
                {t("puzzle.streak.label", {
                  count: data.streak.current,
                  left: data.streak.nextBoosterIn,
                })}
              </h3>
              <ol className="pz-dots">
                {streakDots(data.streak).map((dot, i) => (
                  <li
                    key={i}
                    className={`pz-dot${dot.filled ? " pz-dot--on" : ""}${dot.gift ? " pz-dot--gift" : ""}`}
                  >
                    {dot.gift ? (
                      <IconGift size={15} />
                    ) : (
                      dot.filled && <IconCheck size={12} />
                    )}
                  </li>
                ))}
              </ol>
            </section>

            <button
              type="button"
              className="pz-play"
              onClick={() => navigate(PUZZLE_PLAY_PATH)}
            >
              {data.solved ? t("puzzle.replay") : t("puzzle.play")}
            </button>
            {data.solved && (
              <p className="pz-note">{t("puzzle.already_solved")}</p>
            )}
          </>
        )}

        {data && (
          <p className="pz-note pz-unlimited">
            {t("puzzle.unlimited", { time: countdown(data.nextResetAt, now) })}
          </p>
        )}
      </div>
    </div>
  );
}
