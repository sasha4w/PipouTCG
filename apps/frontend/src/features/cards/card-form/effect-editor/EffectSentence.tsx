import { useTranslation } from "react-i18next";
import { EffectConditionType, TRIGGERS_BY_KIND } from "@pipou/shared";
import type { CardEffect, CardKind, EffectIssue } from "@pipou/shared";
import ActionSentence from "./ActionSentence";
import ConditionFields from "./ConditionFields";
import { SelectHole, Word } from "./Hole";
import { newEffect, setTrigger } from "./effectDraft";
import { labelOrName } from "./labels";

/** Un effet : « Quand [déclencheur], si [condition] : » puis ses actions. */
export default function EffectSentence({
  kind,
  effect,
  issues,
  onChange,
  onRemove,
}: {
  kind: CardKind;
  effect: CardEffect;
  /** Problèmes de CET effet (déjà filtrés). */
  issues: EffectIssue[];
  onChange: (e: CardEffect) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const allowed = TRIGGERS_BY_KIND[kind];
  const triggers = allowed.includes(effect.trigger)
    ? allowed
    : [effect.trigger, ...allowed];
  const issueText = (code: EffectIssue["code"]) =>
    t(`admin.effectEditor.issue.${code}`);

  const setAction = (i: number, a: CardEffect["actions"][number]) =>
    onChange({
      ...effect,
      actions: effect.actions.map((x, j) => (j === i ? a : x)),
    });

  return (
    <div className="effect-sentence">
      <div className="effect-line">
        <Word>{t("admin.effectEditor.when")}</Word>
        <SelectHole
          label={t("admin.effectEditor.when")}
          value={effect.trigger}
          onChange={(trigger) => trigger && onChange(setTrigger(effect, trigger))}
          options={triggers.map((x) => ({
            value: x,
            label: labelOrName(t, `effects.trigger.${x}`, x),
          }))}
        />
        <Word>{t("admin.effectEditor.if")}</Word>
        {effect.condition ? (
          <>
            <ConditionFields
              value={effect.condition}
              onChange={(condition) => onChange({ ...effect, condition })}
            />
            <button
              type="button"
              className="effect-btn"
              aria-label={t("admin.effectEditor.remove")}
              onClick={() => onChange({ ...effect, condition: undefined })}
            >
              ×
            </button>
          </>
        ) : (
          <button
            type="button"
            className="effect-btn"
            onClick={() =>
              onChange({
                ...effect,
                condition: { type: EffectConditionType.DRAKON_ON_BOARD },
              })
            }
          >
            {t("admin.effectEditor.noCondition")}
          </button>
        )}
        <button
          type="button"
          className="effect-btn"
          aria-label={t("admin.effectEditor.removeEffect", {
            defaultValue: "Retirer l'effet",
          })}
          onClick={onRemove}
        >
          ×
        </button>
      </div>

      {issues
        .filter((i) => i.action === undefined)
        .map((i) => (
          <p key={i.code} className="effect-issue">
            {issueText(i.code)}
          </p>
        ))}

      {effect.actions.map((a, i) => (
        <ActionSentence
          key={i}
          action={a}
          issue={
            issues.find((x) => x.action === i)
              ? issueText(issues.find((x) => x.action === i)!.code)
              : undefined
          }
          onChange={(next) => setAction(i, next)}
          onRemove={() =>
            onChange({
              ...effect,
              actions: effect.actions.filter((_, j) => j !== i),
            })
          }
        />
      ))}

      <button
        type="button"
        className="effect-btn"
        onClick={() =>
          onChange({
            ...effect,
            actions: [
              ...effect.actions,
              newEffect(kind).actions[0],
            ],
          })
        }
      >
        {t("admin.effectEditor.addAction")}
      </button>
    </div>
  );
}
