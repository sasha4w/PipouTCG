import { useTranslation } from "react-i18next";
import {
  ACTION_SCHEMA,
  ActionType,
  Archetype,
  EffectConditionType,
} from "@pipou/shared";
import type { EffectAction } from "@pipou/shared";
import ConditionFields from "./ConditionFields";
import FilterFields from "./FilterFields";
import { NumberHole, SelectHole, Word } from "./Hole";
import { advancedKeys, setActionType } from "./effectDraft";
import { labelOrName } from "./labels";

/** Une action sous forme de phrase : « inflige [2] à [cible] pendant [1] tour(s) ». */
export default function ActionSentence({
  action,
  onChange,
  onRemove,
  issue,
}: {
  action: EffectAction;
  onChange: (a: EffectAction) => void;
  onRemove: () => void;
  issue?: string;
}) {
  const { t } = useTranslation();
  const schema = ACTION_SCHEMA[action.type];
  const fields = schema?.fields ?? [];
  const targets = schema?.targets ?? [];
  const set = (patch: Partial<EffectAction>) => onChange({ ...action, ...patch });
  const extra = advancedKeys(action);
  const tr = (key: string, name: string) => labelOrName(t, key, name);
  const targetOptions = targets.includes(action.target)
    ? targets
    : [action.target, ...targets];

  return (
    <div className="effect-action">
      <div className="effect-line">
        <SelectHole
          label={t("admin.effectEditor.actionLabel", { defaultValue: "action" })}
          value={action.type}
          onChange={(type) => type && onChange(setActionType(action, type))}
          options={Object.values(ActionType).map((a) => ({
            value: a,
            label: tr(`admin.effectEditor.action.${a}`, a),
          }))}
        />
        <Word>{t("admin.effectEditor.on")}</Word>
        <SelectHole
          label={t("admin.effectEditor.targetLabel", { defaultValue: "cible" })}
          value={action.target}
          onChange={(target) => target && set({ target })}
          options={targetOptions.map((x) => ({
            value: x,
            label: t(`effects.target.${x}`, {
              archetype: action.archetype ?? "…",
              defaultValue: x,
            }),
          }))}
        />
        {fields.includes("value") && (
          <>
            <Word>{t("admin.effectEditor.of")}</Word>
            <NumberHole
              label={t("admin.effectEditor.value")}
              value={action.value}
              onChange={(value) => set({ value })}
            />
          </>
        )}
        {fields.includes("duration") && (
          <>
            <Word>{t("admin.effectEditor.during")}</Word>
            <NumberHole
              label={t("admin.effectEditor.duration")}
              value={action.duration}
              onChange={(duration) => set({ duration })}
            />
            <Word>{t("admin.effectEditor.turns")}</Word>
          </>
        )}
        {fields.includes("archetype") && (
          <SelectHole
            label={t("admin.effectEditor.archetype")}
            value={action.archetype as Archetype | undefined}
            onChange={(archetype) => set({ archetype })}
            emptyLabel={t("admin.effectEditor.any")}
            options={Object.values(Archetype).map((a) => ({
              value: a,
              label: tr(`effects.archetype.${a.toLowerCase()}`, a),
            }))}
          />
        )}
        <button
          type="button"
          className="effect-btn"
          aria-label={t("admin.effectEditor.remove")}
          onClick={onRemove}
        >
          ×
        </button>
      </div>

      {fields.includes("filter") && (
        <div className="effect-line">
          <Word>{t("admin.effectEditor.among")}</Word>
          {action.filter ? (
            <>
              <FilterFields
                value={action.filter}
                onChange={(filter) => set({ filter })}
              />
              <button
                type="button"
                className="effect-btn"
                aria-label={t("admin.effectEditor.remove")}
                onClick={() => set({ filter: undefined })}
              >
                ×
              </button>
            </>
          ) : (
            <button
              type="button"
              className="effect-btn"
              onClick={() => set({ filter: {} })}
            >
              + {t("admin.effectEditor.among")}
            </button>
          )}
        </div>
      )}

      {fields.includes("valueIf") && (
        <div className="effect-line">
          <Word>{t("admin.effectEditor.orIf")}</Word>
          {action.valueIf ? (
            <>
              <NumberHole
                label={t("admin.effectEditor.value")}
                value={action.valueIf.value}
                onChange={(value) =>
                  set({
                    valueIf: {
                      ...action.valueIf!,
                      value: value ?? 0,
                    },
                  })
                }
              />
              <Word>{t("admin.effectEditor.ifWord")}</Word>
              <ConditionFields
                value={action.valueIf.condition}
                onChange={(condition) =>
                  set({ valueIf: { ...action.valueIf!, condition } })
                }
              />
              <button
                type="button"
                className="effect-btn"
                aria-label={t("admin.effectEditor.remove")}
                onClick={() => set({ valueIf: undefined })}
              >
                ×
              </button>
            </>
          ) : (
            <button
              type="button"
              className="effect-btn"
              onClick={() =>
                set({
                  valueIf: {
                    value: action.value ?? 1,
                    condition: { type: EffectConditionType.DRAKON_ON_BOARD },
                  },
                })
              }
            >
              + {t("admin.effectEditor.orIf")}
            </button>
          )}
        </div>
      )}

      {extra.length > 0 && (
        <span className="effect-advanced" title={extra.join(", ")}>
          {t("admin.effectEditor.advanced")}
        </span>
      )}
      {issue && <p className="effect-issue">{issue}</p>}
    </div>
  );
}
