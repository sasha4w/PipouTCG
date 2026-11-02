import { EquipmentSlot } from "@pipou/shared";
import type { CardInstance } from "@pipou/shared";
import { useTranslation } from "react-i18next";

const ORDER: EquipmentSlot[] = [EquipmentSlot.OFFENSIVE, EquipmentSlot.DEFENSIVE, EquipmentSlot.ACCESSORY];

/** Colonne de pastilles collée au bord droit de la carte : une par équipement porté. */
export function EquipmentPips({ equipments }: { equipments: CardInstance[] }) {
  const { t } = useTranslation();
  if (equipments.length === 0) return null;
  const sorted = [...equipments].sort(
    (a, b) =>
      ORDER.indexOf(a.baseCard.equipmentSlot ?? EquipmentSlot.ACCESSORY) -
      ORDER.indexOf(b.baseCard.equipmentSlot ?? EquipmentSlot.ACCESSORY),
  );
  return (
    <div className="zr-equip-pips">
      {sorted.map((eq) => {
        const slot = eq.baseCard.equipmentSlot ?? EquipmentSlot.ACCESSORY;
        const label = `${t(`glossary.equipmentSlot.${slot}`)} : ${eq.baseCard.name}`;
        return (
          <span
            key={eq.instanceId}
            role="img"
            data-slot={slot}
            className={`zr-equip-pip zr-equip-pip--${slot.toLowerCase()}`}
            aria-label={label}
            title={label}
          />
        );
      })}
    </div>
  );
}
