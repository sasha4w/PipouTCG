import {
  GameState,
  MonsterOnBoard,
} from '../interfaces/game-state.interface';

export interface EffectContext {
  game: GameState;
  ownerUserId: number;
  sourceMonster?: MonsterOnBoard;
  targetMonster?: MonsterOnBoard;
  log: string[];
}
