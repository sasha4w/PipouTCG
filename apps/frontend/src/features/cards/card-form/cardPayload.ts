import {
  CardType,
  Rarity,
  SupportType,
  cardKindOf,
  validateEffects,
} from "@pipou/shared";
import type { Card, CreateCardData } from "../../../services/card.service";

export const emptyForm: CreateCardData = {
  name: "",
  rarity: Rarity.COMMON,
  type: CardType.MONSTER,
  atk: 0,
  hp: 0,
  cost: 1,
  cardSetId: 0,
};

/** Un monstre n'envoie aucun champ de support ; un support, ceux de son sous-type seulement. */
export function toCardPayload(form: CreateCardData): CreateCardData {
  const data: CreateCardData = { ...form };
  const st = data.type === CardType.SUPPORT ? data.supportType : undefined;
  if (!st) delete data.supportType;
  if (st !== SupportType.EQUIPMENT) delete data.equipmentSlot;
  if (st !== SupportType.PERSISTENT) delete data.isTerrain;
  if (st !== SupportType.CHARGE) {
    delete data.chargeMax;
    delete data.chargeMode;
  }
  return data;
}

/** Valeurs du formulaire d'édition pour une carte existante. */
export function fromCard(c: Card): CreateCardData {
  return {
    name: c.name,
    description: c.description ?? "",
    rarity: c.rarity,
    type: c.type,
    atk: c.atk,
    hp: c.hp,
    cost: c.cost,
    cardSetId: c.cardSet.id,
    supportType: c.supportType ?? undefined,
    equipmentSlot: c.equipmentSlot ?? undefined,
    isTerrain: c.isTerrain ?? undefined,
    chargeMax: c.chargeMax ?? undefined,
    chargeMode: c.chargeMode ?? undefined,
    archetype: c.archetype ?? undefined,
    element: c.element ?? undefined,
    lineage: c.lineage ?? undefined,
    stage: c.stage ?? undefined,
    effects: c.effects ?? [],
  };
}

/** Raisons pour lesquelles la carte ne peut pas encore être enregistrée. */
export function formProblems(form: CreateCardData): string[] {
  const problems: string[] = [];
  if (!form.name.trim()) problems.push("Le nom est requis.");
  if (!form.cardSetId) problems.push("Veuillez sélectionner un Card Set.");
  if (form.type === CardType.SUPPORT) {
    if (!form.supportType) problems.push("Choisis un type de support.");
    else if (form.supportType === SupportType.EQUIPMENT && !form.equipmentSlot)
      problems.push("Choisis un emplacement.");
  }
  const kind = cardKindOf({
    type: form.type,
    supportType: form.supportType,
  });
  const issues = validateEffects(kind, form.effects ?? []);
  if (issues.length > 0)
    problems.push(`${issues.length} problème(s) dans les effets.`);
  return problems;
}

/** L'étape « réglages » a-t-elle quelque chose à afficher pour cette carte ? */
export function hasTypeFields(form: CreateCardData): boolean {
  if (form.type === CardType.MONSTER) return true;
  return (
    form.supportType === SupportType.EQUIPMENT ||
    form.supportType === SupportType.PERSISTENT ||
    form.supportType === SupportType.CHARGE
  );
}
