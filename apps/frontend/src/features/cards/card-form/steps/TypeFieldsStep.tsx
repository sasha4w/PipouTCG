import { CardType, ChargeMode, EquipmentSlot, SupportType } from "@pipou/shared";
import type { StepProps } from "./stepTypes";

const SLOT_LABELS: Record<EquipmentSlot, string> = {
  OFFENSIVE: "Offensif",
  DEFENSIVE: "Défensif",
  ACCESSORY: "Accessoire",
};

export default function TypeFieldsStep({ form, patch }: StepProps) {
  return (
    <div className="manager-form">
      <p className="manager-form__title">
        {form.type === CardType.MONSTER ? "Stats" : "Réglages du support"}
      </p>

      {form.type === CardType.MONSTER && (
        <div className="manager-form__grid">
          <div className="manager-form__row">
            <label className="manager-form__label" htmlFor="card-atk">
              ATK
            </label>
            <input
              id="card-atk"
              className="manager-form__input"
              type="number"
              min={0}
              value={form.atk}
              onChange={(e) => patch({ atk: Number(e.target.value) })}
            />
          </div>
          <div className="manager-form__row">
            <label className="manager-form__label" htmlFor="card-hp">
              HP
            </label>
            <input
              id="card-hp"
              className="manager-form__input"
              type="number"
              min={0}
              value={form.hp}
              onChange={(e) => patch({ hp: Number(e.target.value) })}
            />
          </div>
        </div>
      )}

      {form.supportType === SupportType.EQUIPMENT && (
        <div className="manager-form__row">
          <label className="manager-form__label" htmlFor="card-equipment-slot">
            Emplacement
          </label>
          <select
            id="card-equipment-slot"
            className="manager-form__select"
            value={form.equipmentSlot ?? ""}
            onChange={(e) =>
              patch({ equipmentSlot: e.target.value as EquipmentSlot })
            }
          >
            <option value="" disabled>
              —
            </option>
            {Object.values(EquipmentSlot).map((sl) => (
              <option key={sl} value={sl}>
                {SLOT_LABELS[sl]}
              </option>
            ))}
          </select>
        </div>
      )}

      {form.supportType === SupportType.PERSISTENT && (
        <div className="manager-form__row">
          <label className="manager-form__label">
            <input
              type="checkbox"
              checked={!!form.isTerrain}
              onChange={(e) => patch({ isTerrain: e.target.checked })}
            />{" "}
            Terrain
          </label>
        </div>
      )}

      {form.supportType === SupportType.CHARGE && (
        <div className="manager-form__grid">
          <div className="manager-form__row">
            <label className="manager-form__label" htmlFor="card-charge-max">
              Charge max
            </label>
            <input
              id="card-charge-max"
              className="manager-form__input"
              type="number"
              min={1}
              max={10}
              value={form.chargeMax ?? 3}
              onChange={(e) => patch({ chargeMax: Number(e.target.value) })}
            />
          </div>
          <div className="manager-form__row">
            <label className="manager-form__label" htmlFor="card-charge-mode">
              Mode
            </label>
            <select
              id="card-charge-mode"
              className="manager-form__select"
              value={form.chargeMode ?? ChargeMode.ONE_SHOT}
              onChange={(e) => patch({ chargeMode: e.target.value as ChargeMode })}
            >
              <option value={ChargeMode.ONE_SHOT}>Usage unique</option>
              <option value={ChargeMode.CYCLIC} disabled>
                Cyclique (bientôt)
              </option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
