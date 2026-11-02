import { useTranslation } from "react-i18next";
import { validateEffects } from "@pipou/shared";
import type { CardEffect, CardKind } from "@pipou/shared";
import EffectSentence from "./EffectSentence";
import { newEffect } from "./effectDraft";
import "./EffectEditor.css";

/** Éditeur d'effets en « phrase à trous » ; les listes viennent de `@pipou/shared`. */
export default function EffectEditor({
  kind,
  value,
  onChange,
}: {
  kind: CardKind;
  value: CardEffect[];
  onChange: (v: CardEffect[]) => void;
}) {
  const { t } = useTranslation();
  const issues = validateEffects(kind, value);

  return (
    <div className="effect-editor">
      {value.length === 0 && (
        <p className="effect-empty">{t("admin.effectEditor.noEffects")}</p>
      )}
      {value.map((e, i) => (
        <EffectSentence
          key={i}
          kind={kind}
          effect={e}
          issues={issues.filter((x) => x.effect === i)}
          onChange={(next) => onChange(value.map((x, j) => (j === i ? next : x)))}
          onRemove={() => onChange(value.filter((_, j) => j !== i))}
        />
      ))}
      <button
        type="button"
        className="effect-btn"
        onClick={() => onChange([...value, newEffect(kind)])}
      >
        {t("admin.effectEditor.addEffect")}
      </button>
    </div>
  );
}
