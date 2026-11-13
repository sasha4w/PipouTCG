import { useTranslation } from "react-i18next";
import type { PuzzleObjectiveView } from "@pipou/shared";
import { IconTarget } from "../../components/Icons";
import { objectiveText } from "./puzzleView";

interface Props {
  objective: PuzzleObjectiveView;
  /** Partie de test admin : aucune récompense. */
  test: boolean;
}

/** Bandeau d'objectif au-dessus du plateau. */
export default function PuzzleObjectiveBanner({ objective, test }: Props) {
  const { t } = useTranslation();
  const { key, vars } = objectiveText(objective);
  return (
    <div className="pz-banner" role="status">
      <IconTarget size={18} />
      <span className="pz-banner__text">{t(key, vars)}</span>
      {test && (
        <span className="pz-banner__test">{t("puzzle.session.test_badge")}</span>
      )}
    </div>
  );
}
