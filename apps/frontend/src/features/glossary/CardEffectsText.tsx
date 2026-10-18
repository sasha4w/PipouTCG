import { useTranslation } from "react-i18next";
import type { Card } from "../../services/card.service";
import { describeCardEffects } from "../fight/effectText";
import { renderEffectText } from "../fight/renderEffectText";
import "./CardGlossary.css";

/** Effets d'une carte rédigés comme en combat, en un paragraphe compact. */
export default function CardEffectsText({ card }: { card: Card }) {
  const { t } = useTranslation();
  const { rules } = describeCardEffects(card, t);
  if (rules.length === 0)
    return <p className="cg__effects cg__effects--none">Aucun effet</p>;
  return (
    <p className="cg__effects">
      {rules.map((rule, i) => (
        <span key={i}>
          <span className="cg__trigger">{rule.trigger} : </span>
          {rule.lines.map((line, j) => (
            <span key={j}>{renderEffectText(line.text)} </span>
          ))}
        </span>
      ))}
    </p>
  );
}
