import {
  CardEffect,
  EffectConditionType as ConditionType,
  SupportType,
} from '@pipou/shared';
import type { EffectAction, EffectCondition } from '@pipou/shared';
import { EffectContext } from './effect-context.interface';
import { cardNameMatches } from './card-name';

/** Vrai si la condition de l'effet est remplie (ou absente). */
export function checkCondition(
  effect: CardEffect,
  ctx: EffectContext,
): boolean {
  return conditionMet(effect.condition, ctx);
}

/** Vrai si la condition est remplie (ou absente). */
export function conditionMet(
  condition: EffectCondition | null | undefined,
  ctx: EffectContext,
): boolean {
  if (!condition) return true;

  const owner =
    ctx.game.player1.userId === ctx.ownerUserId
      ? ctx.game.player1
      : ctx.game.player2;
  const opponent =
    owner === ctx.game.player1 ? ctx.game.player2 : ctx.game.player1;
  const expectedName = String(condition.value ?? '');

  switch (condition.type) {
    case ConditionType.ARCHETYPE_ON_BOARD: {
      const arch = expectedName.toLowerCase();
      return owner.monsterZones.some(
        (m) => m?.card.baseCard.archetype?.toLowerCase() === arch,
      );
    }

    case ConditionType.HP_BELOW:
      return (
        !!ctx.sourceMonster &&
        ctx.sourceMonster.currentHp < Number(condition.value)
      );

    case ConditionType.HAND_SIZE_MIN:
      return owner.hand.length >= Number(condition.value);

    case ConditionType.OPPONENT_HAS_NO_MONSTERS:
      return opponent.monsterZones.every((z) => z === null);

    case ConditionType.SPECIFIC_CARD_ON_BOARD: {
      const matches = (name: string) =>
        cardNameMatches(name, expectedName, condition.match);
      return owner.monsterZones.some(
        (m) =>
          !!m &&
          (matches(m.card.baseCard.name) ||
            m.equipments.some((e) => matches(e.baseCard.name))),
      );
    }

    case ConditionType.DRAKON_ON_BOARD:
      return owner.monsterZones.some(
        (m) =>
          !!m &&
          (!condition.element ||
            m.card.baseCard.element === condition.element) &&
          (!condition.stage || m.card.baseCard.stage === condition.stage),
      );

    case ConditionType.EQUIPPED_ON: {
      const host = ctx.sourceMonster?.card.baseCard;
      return (
        ctx.sourceCard?.baseCard.supportType === SupportType.EQUIPMENT &&
        !!host &&
        (condition.value === undefined ||
          cardNameMatches(host.name, expectedName, condition.match)) &&
        (!condition.element || host.element === condition.element) &&
        (!condition.stage || host.stage === condition.stage)
      );
    }

    default:
      return false;
  }
}

/** L'action avec sa valeur conditionnelle appliquée si la condition est remplie. */
export function withConditionalValue(
  action: EffectAction,
  ctx: EffectContext,
): EffectAction {
  return action.valueIf && conditionMet(action.valueIf.condition, ctx)
    ? { ...action, value: action.valueIf.value }
    : action;
}
