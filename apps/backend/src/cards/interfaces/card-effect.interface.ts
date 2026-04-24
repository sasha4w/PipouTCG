export enum EffectTrigger {
  ON_SUMMON = 'ON_SUMMON',
  ON_DEATH = 'ON_DEATH',
  ON_ATTACK = 'ON_ATTACK',
  ON_DEFEND = 'ON_DEFEND',
  ON_PLAY = 'ON_PLAY',
  ON_TURN_START = 'ON_TURN_START',
  ON_TURN_END = 'ON_TURN_END',
  PASSIVE = 'PASSIVE',
}

export enum ConditionType {
  ARCHETYPE_ON_BOARD = 'ARCHETYPE_ON_BOARD',
  HP_BELOW = 'HP_BELOW',
  HAND_SIZE_MIN = 'HAND_SIZE_MIN',
  OPPONENT_HAS_NO_MONSTERS = 'OPPONENT_HAS_NO_MONSTERS',
  SPECIFIC_CARD_ON_BOARD = 'SPECIFIC_CARD_ON_BOARD',
}

export enum ActionType {
  DEAL_DAMAGE = 'DEAL_DAMAGE',
  HEAL = 'HEAL',
  DRAW = 'DRAW',
  BUFF_ATK = 'BUFF_ATK',
  BUFF_HP = 'BUFF_HP',
  BUFF_ATK_TEMP = 'BUFF_ATK_TEMP',
  STEAL_PRIME = 'STEAL_PRIME',
  DESTROY_MONSTER = 'DESTROY_MONSTER',
  RETURN_TO_HAND = 'RETURN_TO_HAND',
  DISCARD = 'DISCARD',
  SET_TAUNT = 'SET_TAUNT',
  SET_PIERCING = 'SET_PIERCING',
  SET_ATTACKS_PER_TURN = 'SET_ATTACKS_PER_TURN',
  SET_DEBUFF_IMMUNITY = 'SET_DEBUFF_IMMUNITY',
  SET_DELAY_DOUBLE_ATK = 'SET_DELAY_DOUBLE_ATK',
  FORCE_ATTACK_MODE = 'FORCE_ATTACK_MODE',
  RETURN_FROM_GRAVEYARD = 'RETURN_FROM_GRAVEYARD',
  RETURN_FROM_GRAVEYARD_OR_DECK = 'RETURN_FROM_GRAVEYARD_OR_DECK',
  SEARCH_DECK = 'SEARCH_DECK',
  GAIN_RECYCLE_ENERGY = 'GAIN_RECYCLE_ENERGY',
}

export enum EffectTarget {
  SELF = 'SELF',
  ALLY_MONSTER = 'ALLY_MONSTER',
  ALL_ALLIES = 'ALL_ALLIES',
  ALLIES_EXCEPT_SELF = 'ALLIES_EXCEPT_SELF',
  ENEMY_MONSTER = 'ENEMY_MONSTER',
  ALL_ENEMIES = 'ALL_ENEMIES',
  PLAYER = 'PLAYER',
  OPPONENT = 'OPPONENT',
  ARCHETYPE_ALLIES = 'ARCHETYPE_ALLIES',
  TARGET_ALLY = 'TARGET_ALLY',
}

export interface EffectCondition {
  type: ConditionType;
  value?: number | string;
}

export interface EffectFilter {
  archetype?: string;
  rarities?: string[];
  type?: string;
  name?: string;
}

export interface EffectAction {
  type: ActionType;
  target: EffectTarget;
  value?: number;
  archetype?: string;
  filter?: EffectFilter;
}

export interface CardEffect {
  trigger: EffectTrigger;
  condition?: EffectCondition | null;
  actions: EffectAction[];
}
