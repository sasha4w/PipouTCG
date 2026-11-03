import { useTranslation } from "react-i18next";
import type { CreateCardData } from "../../../services/card.service";
import CardFace from "../CardFace";
import { describeCardEffects } from "../../fight/effectText";
import { renderEffectText } from "../../fight/renderEffectText";

/** Aperçu en direct : la carte et son texte d'effet tel qu'il apparaîtra en jeu. */
export default function CardPreview({
  form,
  imageUrl,
}: {
  form: CreateCardData;
  imageUrl: string | null;
}) {
  const { t } = useTranslation();
  const { rules } = describeCardEffects(
    {
      type: form.type,
      supportType: form.supportType,
      archetype: form.archetype,
      stage: form.stage,
      effects: form.effects,
    },
    t,
  );

  return (
    <aside className="card-preview">
      <CardFace
        size="md"
        showDescription
        card={{
          id: 0,
          name: form.name || "—",
          rarity: form.rarity,
          type: form.type,
          atk: form.atk,
          hp: form.hp,
          cost: form.cost,
          supportType: form.supportType,
          description: form.description,
          image: imageUrl ? { url: imageUrl } : null,
        }}
      />
      {rules.length > 0 && (
        <p className="card-preview__effects">
          {rules.map((rule, i) => (
            <span key={i}>
              <strong>{rule.trigger} : </strong>
              {rule.lines.map((line, j) => (
                <span key={j}>{renderEffectText(line.text)} </span>
              ))}
            </span>
          ))}
        </p>
      )}
    </aside>
  );
}
