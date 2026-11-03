import { useTranslation } from "react-i18next";
import {
  Archetype,
  CONDITION_FIELDS,
  DrakonElement,
  DrakonStage,
  EffectConditionType,
} from "@pipou/shared";
import type { EffectCondition } from "@pipou/shared";
import { NumberHole, SelectHole, TextHole } from "./Hole";
import { setConditionType } from "./effectDraft";
import { labelOrName } from "./labels";

const NUMERIC: EffectConditionType[] = [
  EffectConditionType.HP_BELOW,
  EffectConditionType.HAND_SIZE_MIN,
];

/** Type de condition et ses champs ; sert à la condition d'effet et au `valueIf`. */
export default function ConditionFields({
  value,
  onChange,
}: {
  value: EffectCondition;
  onChange: (c: EffectCondition) => void;
}) {
  const { t } = useTranslation();
  const fields = CONDITION_FIELDS[value.type] ?? [];
  const set = (patch: Partial<EffectCondition>) =>
    onChange({ ...value, ...patch });
  const tr = (key: string, name: string) => labelOrName(t, key, name);
  const any = t("admin.effectEditor.any");

  return (
    <>
      <SelectHole
        label={t("admin.effectEditor.if")}
        value={value.type}
        onChange={(type) => type && onChange(setConditionType(value, type))}
        options={Object.values(EffectConditionType).map((c) => ({
          value: c,
          label: tr(`admin.effectEditor.condition.${c}`, c),
        }))}
      />
      {fields.includes("value") &&
        (value.type === EffectConditionType.ARCHETYPE_ON_BOARD ? (
          <SelectHole
            label={t("admin.effectEditor.archetype")}
            value={value.value as string | undefined}
            onChange={(v) => set({ value: v })}
            emptyLabel={any}
            options={Object.values(Archetype).map((a) => ({
              value: a,
              label: tr(`effects.archetype.${a.toLowerCase()}`, a),
            }))}
          />
        ) : NUMERIC.includes(value.type) ? (
          <NumberHole
            label={t("admin.effectEditor.value")}
            value={typeof value.value === "number" ? value.value : undefined}
            onChange={(v) => set({ value: v })}
          />
        ) : (
          <TextHole
            label={t("admin.effectEditor.filter.name")}
            value={value.value === undefined ? undefined : String(value.value)}
            onChange={(v) => set({ value: v })}
          />
        ))}
      {fields.includes("match") && (
        <SelectHole
          label={t("admin.effectEditor.match.exact")}
          value={value.match ?? "exact"}
          onChange={(m) => set({ match: m })}
          options={(["exact", "contains"] as const).map((m) => ({
            value: m,
            label: t(`admin.effectEditor.match.${m}`),
          }))}
        />
      )}
      {fields.includes("element") && (
        <SelectHole
          label={t("admin.effectEditor.filter.element")}
          value={value.element}
          onChange={(v) => set({ element: v })}
          emptyLabel={any}
          options={Object.values(DrakonElement).map((e) => ({
            value: e,
            label: tr(`effects.element.${e}`, e),
          }))}
        />
      )}
      {fields.includes("stage") && (
        <SelectHole
          label={t("admin.effectEditor.filter.stage")}
          value={value.stage}
          onChange={(v) => set({ stage: v })}
          emptyLabel={any}
          options={Object.values(DrakonStage).map((s) => ({
            value: s,
            label: tr(`effects.stage.${s}`, s),
          }))}
        />
      )}
    </>
  );
}
