import { EquipmentSlot } from "@pipou/shared";
import { useTranslation } from "react-i18next";
import "./EquipmentSlotList.css";

/** Équipement affichable dans un emplacement. */
export interface SlotEquipment {
  name: string;
  equipmentSlot: EquipmentSlot | null;
}

/** Quatre emplacements : Offensif, Défensif, 2 Accessoires. */
const SLOT_ROWS: EquipmentSlot[] = [
  EquipmentSlot.OFFENSIVE,
  EquipmentSlot.DEFENSIVE,
  EquipmentSlot.ACCESSORY,
  EquipmentSlot.ACCESSORY,
];

function slotRows(equipments: SlotEquipment[]) {
  const pool = [...equipments];
  return SLOT_ROWS.map((slot) => {
    const i = pool.findIndex(
      (e) => (e.equipmentSlot ?? EquipmentSlot.ACCESSORY) === slot,
    );
    return { slot, equipment: i >= 0 ? pool.splice(i, 1)[0] : null };
  });
}

/** Les 4 emplacements d'équipement d'un monstre, vides compris (« — »). */
export default function EquipmentSlotList({
  equipments,
}: {
  equipments: SlotEquipment[];
}) {
  const { t } = useTranslation();
  return (
    <ul className="ci-slots">
      {slotRows(equipments).map(({ slot, equipment }, i) => (
        <li key={i} className="ci-slot">
          <span className="ci-slot__label">
            {t(`glossary.equipmentSlot.${slot}`)}
          </span>
          <span className="ci-slot__name">
            {equipment ? equipment.name : "—"}
          </span>
        </li>
      ))}
    </ul>
  );
}
