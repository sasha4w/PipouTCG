import {
  ActionType,
  EffectConditionType,
  EffectTarget,
  EffectTrigger,
} from '@pipou/shared';

// Ce que le moteur sait résoudre. Ajouter une valeur à un enum d'effet sans
// l'implémenter puis la déclarer ici fait échouer effects-coverage.spec.ts.

export const SUPPORTED_TRIGGERS: ReadonlySet<EffectTrigger> = new Set([
  EffectTrigger.ON_SUMMON,
  EffectTrigger.ON_DEATH,
  EffectTrigger.ON_ATTACK,
  EffectTrigger.ON_DEFEND,
  EffectTrigger.ON_PLAY,
  EffectTrigger.ON_TURN_START,
  EffectTrigger.ON_TURN_END,
  EffectTrigger.ON_ALLY_SUMMON,
  EffectTrigger.PASSIVE,
  EffectTrigger.ON_RECYCLE,
]);

export const SUPPORTED_CONDITIONS: ReadonlySet<EffectConditionType> = new Set([
  EffectConditionType.ARCHETYPE_ON_BOARD,
  EffectConditionType.HP_BELOW,
  EffectConditionType.HAND_SIZE_MIN,
  EffectConditionType.OPPONENT_HAS_NO_MONSTERS,
  EffectConditionType.SPECIFIC_CARD_ON_BOARD,
  EffectConditionType.EQUIPPED_ON,
]);

export const SUPPORTED_ACTIONS: ReadonlySet<ActionType> = new Set([
  ActionType.DEAL_DAMAGE,
  ActionType.HEAL,
  ActionType.DRAW,
  ActionType.BUFF_ATK,
  ActionType.BUFF_HP,
  ActionType.BUFF_ATK_TEMP,
  ActionType.DESTROY_MONSTER,
  ActionType.RETURN_TO_HAND,
  ActionType.DISCARD,
  ActionType.SET_TAUNT,
  ActionType.SET_PIERCING,
  ActionType.SET_ATTACKS_PER_TURN,
  ActionType.SET_DEBUFF_IMMUNITY,
  ActionType.SET_DELAY_DOUBLE_ATK,
  ActionType.FORCE_ATTACK_MODE,
  ActionType.RETURN_FROM_GRAVEYARD,
  ActionType.RETURN_FROM_GRAVEYARD_OR_DECK,
  ActionType.SEARCH_DECK,
  ActionType.GAIN_RECYCLE_ENERGY,
  ActionType.SET_FREE_SUMMON,
  ActionType.SET_DAMAGE_REDUCTION,
  ActionType.BUFF_HP_PER_ADJACENT_ALLY,
  ActionType.SET_TURN_COUNTER,
  ActionType.FORCE_ATTACK_MODE_ENEMY,
  ActionType.BLOCK_ATTACK,
  ActionType.FORCE_GUARD_LOCK_ENEMY,
  ActionType.CANNOT_ATTACK_ON_SUMMON_TURN,
  ActionType.SUMMONABLE_ON_ENEMY_SIDE,
]);

export const SUPPORTED_TARGETS: ReadonlySet<EffectTarget> = new Set(
  Object.values(EffectTarget),
);
