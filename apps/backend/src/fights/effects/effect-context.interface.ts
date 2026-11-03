import {
  CardInstance,
  GameState,
  MonsterOnBoard,
} from '../interfaces/game-state.interface';

export interface EffectContext {
  game: GameState;
  ownerUserId: number;
  sourceMonster?: MonsterOnBoard;
  targetMonster?: MonsterOnBoard;
  /** Carte qui porte l'effet en cours de résolution. */
  sourceCard?: CardInstance;
  log: string[];
  /** Résolution de l'ON_CHARGED d'une Charge : l'applier note si l'effet n'a rien fait. */
  charge?: { fizzled: boolean };
}
