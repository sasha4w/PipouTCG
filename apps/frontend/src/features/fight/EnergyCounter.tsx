import { useTranslation } from "react-i18next";
import { IconBolt } from "../../components/Icons";
import "./EnergyCounter.css";

/** Réserve d'énergie de recyclage, toujours visible pendant le combat. */
export default function EnergyCounter({ value }: { value: number }) {
  const { t } = useTranslation();
  return (
    <div
      className="enc"
      role="status"
      aria-label={t("fight.hud.energy", { count: value })}
    >
      <IconBolt size={14} />
      <span className="enc-value">{value}</span>
    </div>
  );
}
