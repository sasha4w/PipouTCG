import { ActionType, EffectTrigger, isImplanted } from '@pipou/shared';
import type {
  CardInstance,
  PlayerGameState,
} from '../interfaces/game-state.interface';
import { matchesFilter } from '../effects/pick-candidates';

/**
 * Nom de la carte exigée par le support (REQUIRES_CARD_ON_BOARD) et absente
 * du terrain de son propriétaire, sinon null.
 */
export function missingRequirement(
  card: CardInstance,
  owner: PlayerGameState,
): string | null {
  for (const e of card.baseCard.effects ?? []) {
    if (e.trigger !== EffectTrigger.PASSIVE) continue;
    for (const a of e.actions) {
      if (a.type !== ActionType.REQUIRES_CARD_ON_BOARD) continue;
      const present = owner.monsterZones.some(
        (m) =>
          !!m &&
          !isImplanted(m, owner.userId) &&
          matchesFilter(m.card, a.filter),
      );
      if (!present) return a.filter?.name ?? 'une carte précise';
    }
  }
  return null;
}
