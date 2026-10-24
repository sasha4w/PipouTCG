import { ActionType, CardType } from '@pipou/shared';
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
  if (filter.element && c.element !== filter.element) return false;
  if (filter.stage && c.stage !== filter.stage) return false;
  return true;
}

/**
 * Cartes qu'une action « récupérer / chercher » propose au joueur
 * (cimetière, deck ou les deux selon l'action). Vide pour les autres actions.
 * La carte qui porte l'effet (`effectCard`) ne se propose jamais elle-même.
 */
export function pickCandidates(
  action: EffectAction,
  player: PlayerGameState,
  effectCard?: CardInstance,
): ChoiceCandidate[] {
  const from = (
    pile: CardInstance[],
    source: 'graveyard' | 'deck',
  ): ChoiceCandidate[] =>
    pile
      .filter(
        (c) =>
          c.instanceId !== effectCard?.instanceId &&
          matchesFilter(c, action.filter),
      )
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
    case ActionType.SUMMON_FROM_DECK:
      return from(player.deck, 'deck').filter(
        (c) => c.baseCard.type === CardType.MONSTER,
      );
    default:
      return [];
  }
}
