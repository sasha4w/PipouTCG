import { useTranslation } from "react-i18next";
import type { TutorialResultPayload } from "@pipou/shared";
import Button from "../../components/Button";
import { IconGold, IconStar, IconTrophy } from "../../components/Icons";

interface Props {
  /** null : le serveur n'a pas pu enregistrer le résultat. */
  result: TutorialResultPayload | null;
  /** Leçon suivante, ou null après la dernière. */
  hasNext: boolean;
  onNext: () => void;
  onReplay: () => void;
  onBack: () => void;
}

/** Fin d'une leçon : récompense versée une seule fois. */
export default function TutorialResult({
  result,
  hasNext,
  onNext,
  onReplay,
  onBack,
}: Props) {
  const { t } = useTranslation();
  const completed = result?.completed ?? false;
  return (
    <div className="tut-result">
      <h2 className="tut-result__title">
        {completed ? (
          <>
            <IconTrophy size={26} /> {t("tutorial.ui.resultTitleDone")}
          </>
        ) : (
          t("tutorial.ui.resultTitleQuit")
        )}
      </h2>
      {completed && result?.firstCompletion ? (
        <p className="tut-result__reward">
          <IconGold size={18} /> +{result.gold} <IconStar size={18} /> +
          {result.xp} XP
        </p>
      ) : (
        <p className="tut-result__note">
          {completed
            ? t("tutorial.ui.resultAlready")
            : t("tutorial.ui.resultQuit")}
        </p>
      )}
      <div className="tut-result__actions">
        {completed && hasNext && (
          <Button onClick={onNext}>{t("tutorial.ui.nextLesson")}</Button>
        )}
        <Button variant="ghost-bordeaux" onClick={onReplay}>
          {t("tutorial.ui.replayLesson")}
        </Button>
        <Button variant="ghost-bordeaux" onClick={onBack}>
          {t("tutorial.ui.backToLessons")}
        </Button>
      </div>
    </div>
  );
}
