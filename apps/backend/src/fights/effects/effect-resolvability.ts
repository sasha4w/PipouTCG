import { ActionType, EffectTarget } from '@pipou/shared';
import type { EffectAction } from '@pipou/shared';
import { EffectContext } from './effect-context.interface';
import { resolveTargets } from './effect-targets.resolver';
import { pickCandidates } from './pick-candidates';

/** Cibles choisies par le joueur : leur validité est contrôlée à part. */
const CHOSEN_TARGETS = new Set<EffectTarget>([
  EffectTarget.ENEMY_MONSTER,
  EffectTarget.ALLY_MONSTER,
  EffectTarget.TARGET_ALLY,
]);

const PICK_ACTIONS = new Set<ActionType>([
  ActionType.RETURN_FROM_GRAVEYARD,
  ActionType.RETURN_FROM_GRAVEYARD_OR_DECK,
  ActionType.SEARCH_DECK,
]);

/** Vrai si l'action produirait quelque chose dans l'état actuel de la partie. */
export function canResolveAction(
  action: EffectAction,
  ctx: EffectContext,
): boolean {
  if (CHOSEN_TARGETS.has(action.target)) return true;

  const targets = resolveTargets(action.target, ctx);
  if (PICK_ACTIONS.has(action.type))
    return targets.players.some((p) => pickCandidates(action, p).length > 0);

  switch (action.type) {
    case ActionType.DRAW:
      return targets.players.some((p) => p.deck.length > 0);
    case ActionType.DISCARD:
      return targets.players.some((p) => p.hand.length > 0);
    case ActionType.GAIN_RECYCLE_ENERGY:
    case ActionType.SET_FREE_SUMMON:
      return true;
    default:
      return targets.monsters.length > 0 || targets.players.length > 0;
  }
}
