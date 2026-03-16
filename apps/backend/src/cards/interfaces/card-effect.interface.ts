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
}

export enum ActionType {
  DEAL_DAMAGE = 'DEAL_DAMAGE',
  HEAL = 'HEAL',
  DRAW = 'DRAW',
  BUFF_ATK = 'BUFF_ATK',
  BUFF_HP = 'BUFF_HP',
  STEAL_PRIME = 'STEAL_PRIME',
  DESTROY_MONSTER = 'DESTROY_MONSTER',
  RETURN_TO_HAND = 'RETURN_TO_HAND',
  DISCARD = 'DISCARD',
}

export enum EffectTarget {
  SELF = 'SELF',
  ALLY_MONSTER = 'ALLY_MONSTER',
  ALL_ALLIES = 'ALL_ALLIES',
  ENEMY_MONSTER = 'ENEMY_MONSTER',
  ALL_ENEMIES = 'ALL_ENEMIES',
  PLAYER = 'PLAYER',
  OPPONENT = 'OPPONENT',
  ARCHETYPE_ALLIES = 'ARCHETYPE_ALLIES',
}

export interface EffectCondition {
  type: ConditionType;
  value?: number | string;
}

export interface EffectAction {
  type: ActionType;
  target: EffectTarget;
  value?: number;
  archetype?: string;
}

export interface CardEffect {
  trigger: EffectTrigger;
  condition?: EffectCondition;
  actions: EffectAction[];
}
