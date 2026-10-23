import {
  Archetype,
  isImplanted,
  releveCount,
  type CardEffect,
} from "@pipou/shared";
import type { MonsterOnBoard } from "./fight.types";

/** Relève possible : nombre d'alliés à sacrifier et alliés Pipou disponibles. */
export interface ReleveOptions {
  needed: number;
  allies: MonsterOnBoard[];
}

/**
 * Miroir de la Relève du moteur (summon.service) : la carte a la Relève (N)
 * et j'ai au moins N alliés Pipou non implantés. null sinon.
 */
export function releveOptions(
  card: { effects?: readonly CardEffect[] | null },
  zones: readonly (MonsterOnBoard | null)[],
  userId: number,
): ReleveOptions | null {
  const needed = releveCount(card.effects as CardEffect[] | null | undefined);
  if (needed === 0) return null;
  const allies = zones.filter(
    (m): m is MonsterOnBoard =>
      !!m &&
      !isImplanted(m, userId) &&
      m.card.baseCard.archetype === Archetype.PIPOU,
  );
  return allies.length >= needed ? { needed, allies } : null;
}
