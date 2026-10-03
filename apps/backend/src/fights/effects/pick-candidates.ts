import { ActionType } from '@pipou/shared';
import type { EffectAction, EffectFilter } from '@pipou/shared';
import {
  CardInstance,
  ChoiceCandidate,
  PlayerGameState,
} from '../interfaces/game-state.interface';

/** Vrai si la carte respecte le filtre d'une action de récupération. */
export function matchesFilter(
  card: CardInstance,
  filter: EffectFilter | undefined,
): boolean {
  if (!filter) return true;
  const c = card.baseCard;
  if (filter.archetype && c.archetype !== filter.archetype) return false;
  if (filter.rarities && !filter.rarities.includes(c.rarity)) return false;
  if (filter.type && c.type !== filter.type) return false;
  if (filter.name && !c.name.toLowerCase().includes(filter.name.toLowerCase()))
    return false;
  return true;
}

/**
 * Cartes qu'une action « récupérer / chercher » propose au joueur
 * (cimetière, deck ou les deux selon l'action). Vide pour les autres actions.
 */
export function pickCandidates(
  action: EffectAction,
  player: PlayerGameState,
): ChoiceCandidate[] {
  const from = (
    pile: CardInstance[],
    source: 'graveyard' | 'deck',
  ): ChoiceCandidate[] =>
    pile
      .filter((c) => matchesFilter(c, action.filter))
      .map((c) => ({ instanceId: c.instanceId, baseCard: c.baseCard, source }));

  switch (action.type) {
    case ActionType.RETURN_FROM_GRAVEYARD:
      return from(player.graveyard, 'graveyard');
    case ActionType.RETURN_FROM_GRAVEYARD_OR_DECK:
      return [
        ...from(player.graveyard, 'graveyard'),
        ...from(player.deck, 'deck'),
      ];
    case ActionType.SEARCH_DECK:
      return from(player.deck, 'deck');
    default:
      return [];
  }
}
