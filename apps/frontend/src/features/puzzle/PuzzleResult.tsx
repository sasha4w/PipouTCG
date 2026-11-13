import { useTranslation } from "react-i18next";
import type { PuzzleReward } from "@pipou/shared";
import Button from "../../components/Button";
import { IconBooster, IconCheck, IconGift, IconGold } from "../../components/Icons";
import { streakDots } from "./puzzleView";

interface Props {
  outcome: "solved" | "failed";
  /** Absent : partie de test, ou récompense non versée. */
  reward?: PuzzleReward;
  test: boolean;
  onRestart: () => void;
  onBack: () => void;
}

/** Écran de fin de partie de défi, posé par-dessus le plateau. */
export default function PuzzleResult({
  outcome,
  reward,
  test,
  onRestart,
  onBack,
}: Props) {
  const { t } = useTranslation();
  const solved = outcome === "solved";
  const firstSolve = solved && !test && reward?.firstSolve === true;

  const title = !solved
    ? t("puzzle.result.failed")
    : firstSolve
      ? t("puzzle.result.solved_first")
      : t("puzzle.result.solved");

  return (
    <div className="pz-result" role="dialog" aria-modal="true" aria-label={title}>
      <div className="pz-result__card">
        <h2 className={`pz-result__title${solved ? " pz-result__title--win" : ""}`}>
          {title}
        </h2>

        {!solved && <p className="pz-result__hint">{t("puzzle.result.failed_text")}</p>}

        {solved && !firstSolve && (
          <p className="pz-result__hint">
            {test ? t("puzzle.result.test") : t("puzzle.result.no_reward")}
          </p>
        )}

        {firstSolve && reward && (
          <>
            <ul className="pz-loot">
              <li className="pz-loot__tile pz-loot__tile--gold">
                <IconGold size={24} />
                <strong>{reward.gold}</strong>
              </li>
              <li className="pz-loot__tile pz-loot__tile--xp">
                <strong>{reward.xp}</strong>
                <span>{t("puzzle.result.xp")}</span>
              </li>
            </ul>
            {reward.booster && (
              <p className="pz-result__booster">
                <IconBooster size={20} />
                {t("puzzle.result.booster", { count: reward.streak.current })}
              </p>
            )}
            <p className="pz-result__streak">
              {t("puzzle.streak.label", {
                count: reward.streak.current,
                left: reward.streak.nextBoosterIn,
              })}
            </p>
            <ol className="pz-dots">
              {streakDots(reward.streak).map((dot, i) => (
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
          </>
        )}

        <div className="pz-result__actions">
          {solved ? (
            <>
              <Button variant="ghost-bordeaux" onClick={onBack}>
                {t("puzzle.result.back")}
              </Button>
              <Button onClick={onRestart}>{t("puzzle.result.replay")}</Button>
            </>
          ) : (
            <>
              <Button variant="ghost-bordeaux" onClick={onBack}>
                {t("puzzle.result.back")}
              </Button>
              <Button onClick={onRestart}>{t("puzzle.result.retry")}</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
