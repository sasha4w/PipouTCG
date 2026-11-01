import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { PhaseOption } from "./phaseOptions";
import "./PhaseMenu.css";

interface Props {
  options: PhaseOption[];
  /** Cartes à défausser pour pouvoir finir le tour. */
  discardCount: number;
  onPick: (option: PhaseOption) => void;
  onClose: () => void;
}

/** Menu ancré sous la pastille de phase : uniquement les phases à venir. */
export default function PhaseMenu({
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
        {options.map((o) => {
          const blocked = o.disabledReason === "discard";
          return (
            <button
              key={o.target}
              type="button"
              role="menuitem"
              className="phm-item"
              disabled={blocked}
              onClick={() => onPick(o)}
            >
              <span>{t(`fight.phaseMenu.${o.target}`)}</span>
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
