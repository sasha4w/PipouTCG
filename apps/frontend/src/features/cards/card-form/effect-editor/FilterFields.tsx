import { useTranslation } from "react-i18next";
import { Archetype, CardType, DrakonElement, DrakonStage } from "@pipou/shared";
import type { EffectFilter } from "@pipou/shared";
import { SelectHole, TextHole } from "./Hole";
import { labelOrName } from "./labels";

/** Filtre de cartes d'une action. `rarities` n'est pas édité : il est conservé. */
export default function FilterFields({
  value,
  onChange,
}: {
  value: EffectFilter;
  onChange: (f: EffectFilter) => void;
}) {
  const { t } = useTranslation();
  const set = (patch: Partial<EffectFilter>) =>
    onChange({ ...value, ...patch });
  const tr = (key: string, name: string) => labelOrName(t, key, name);
  const any = t("admin.effectEditor.any");

  return (
    <>
      <SelectHole
        label={t("admin.effectEditor.filter.archetype")}
        value={value.archetype}
        onChange={(v) => set({ archetype: v })}
        emptyLabel={any}
        options={Object.values(Archetype).map((a) => ({
          value: a,
          label: tr(`effects.archetype.${a.toLowerCase()}`, a),
        }))}
      />
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
      <SelectHole
        label={t("admin.effectEditor.filter.type")}
        value={value.type}
        onChange={(v) => set({ type: v })}
        emptyLabel={any}
        options={Object.values(CardType).map((c) => ({
          value: c,
          label: c === CardType.MONSTER ? "monstre" : "support",
        }))}
      />
      <TextHole
        label={t("admin.effectEditor.filter.name")}
        value={value.name}
        onChange={(v) => set({ name: v })}
      />
      <TextHole
        label={t("admin.effectEditor.filter.excludeName")}
        value={value.excludeName}
        onChange={(v) => set({ excludeName: v })}
      />
    </>
  );
}
