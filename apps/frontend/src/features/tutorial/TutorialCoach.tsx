import { Trans, useTranslation } from "react-i18next";
import type { TutorialStepView } from "@pipou/shared";
import Button from "../../components/Button";
import {
  IconArrowRight,
  IconHourglass,
  IconInfo,
} from "../../components/Icons";

interface Props {
  step: TutorialStepView;
  onNext: () => void;
  onQuit: () => void;
}

/** Bulle de la leçon : explication de l'étape, « Suivant » seulement quand il n'y a rien à jouer. */
export default function TutorialCoach({ step, onNext, onQuit }: Props) {
  const { t } = useTranslation();
  return (
    <aside className="tut-coach" role="status" aria-live="polite">
      <div className="tut-coach__head">
        <span className="tut-coach__step">
          {t("tutorial.ui.stepOf", { n: step.index + 1, total: step.total })}
        </span>
        <button type="button" className="tut-coach__quit" onClick={onQuit}>
          {t("tutorial.ui.quit")}
        </button>
      </div>
      <p className="tut-coach__text">
        <IconInfo size={16} />{" "}
        <Trans i18nKey={step.textKey} components={{ b: <strong /> }} />
      </p>
      {step.kind === "info" && (
        <Button onClick={onNext}>
          {t("tutorial.ui.next")}
          <IconArrowRight size={16} />
        </Button>
      )}
      {step.kind === "opponent" && (
        <span className="tut-coach__wait">
          <IconHourglass size={14} /> {t("tutorial.ui.opponentPlaying")}
        </span>
      )}
    </aside>
  );
}
