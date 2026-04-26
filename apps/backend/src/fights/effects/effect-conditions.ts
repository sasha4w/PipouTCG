import {
  CardEffect,
  ConditionType,
} from '../../cards/interfaces/card-effect.interface';
import { EffectContext } from './effect-context.interface';

/**
 * Pure function — returns true if the effect's condition is met (or absent).
 */
export function checkCondition(effect: CardEffect, ctx: EffectContext): boolean {
  if (!effect.condition) return true;

  const owner =
    ctx.game.player1.userId === ctx.ownerUserId ? ctx.game.player1 : ctx.game.player2;
  const opponent =
    ctx.game.player1.userId === ctx.ownerUserId ? ctx.game.player2 : ctx.game.player1;

  switch (effect.condition.type) {
    case ConditionType.ARCHETYPE_ON_BOARD: {
      const arch = effect.condition.value as string;
      return owner.monsterZones.some(
        (m) => m && m.card.baseCard.archetype?.toLowerCase() === arch.toLowerCase(),
      );
    }

    case ConditionType.HP_BELOW:
      return (
        !!ctx.sourceMonster &&
        ctx.sourceMonster.currentHp < (effect.condition.value as number)
      );

    case ConditionType.HAND_SIZE_MIN:
      return owner.hand.length >= (effect.condition.value as number);

    case ConditionType.OPPONENT_HAS_NO_MONSTERS:
      return opponent.monsterZones.every((z) => z === null);

    default:
      return true;
  }
}
