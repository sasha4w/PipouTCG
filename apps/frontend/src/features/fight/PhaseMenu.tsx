import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { Phase } from "./fight.types";
import type { PhaseOption, PhaseTarget } from "./phaseOptions";
import "./PhaseMenu.css";

interface Props {
  /** Phase en cours : elle et les précédentes restent visibles, grisées. */
  phase: Phase;
  options: PhaseOption[];
  /** Cartes à défausser pour pouvoir finir le tour. */
  discardCount: number;
  onPick: (option: PhaseOption) => void;
  onClose: () => void;
}

/** Ordre du tour, présenté en entier : on ne peut qu'avancer. */
const STEPS: ({ id: "main" } | { id: PhaseTarget })[] = [
  { id: "main" },
  { id: "battle" },
  { id: "end" },
  { id: "endTurn" },
];

/** Menu ancré sous la pastille de phase. */
export default function PhaseMenu({
  phase,
  options,
  discardCount,
  onPick,
  onClose,
}: Props) {
  const { t } = useTranslation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="phm-backdrop" onClick={onClose} />
      <div className="phm" role="menu" aria-label={t("fight.phaseMenu.title")}>
        {STEPS.map(({ id }) => {
          const option = options.find((o) => o.target === id);
          const current = id === phase;
          const blocked = option?.disabledReason === "discard";
          return (
            <button
              key={id}
              type="button"
              role="menuitem"
              className={`phm-item${current ? " phm-item--current" : ""}`}
              aria-current={current ? "true" : undefined}
              disabled={!option || blocked}
              onClick={() => option && onPick(option)}
            >
              <span>
                {id === "main"
                  ? t("fight.phase.main")
                  : t(`fight.phaseMenu.${id}`)}
              </span>
              {blocked && (
                <span className="phm-hint">
                  {t("fight.phaseMenu.discard", { count: discardCount })}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
