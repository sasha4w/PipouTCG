import type { GameEngine } from '../engine/game-engine';
import { AiPlayer } from './ai-player';
import type { AiLevel } from './ai-player';
import { defaultNote, evaluatorOf } from './note';
import type { Note } from './note';
import { STRONGEST } from './planner';
import type { ThinkingProfile } from './planner';

/** Cerveau d'un niveau d'aventure : façon de réfléchir, taux d'erreur, note. */
export interface LevelBrain {
  thinking: ThinkingProfile | 'greedy';
  /** Écart de score qui rend un coup e fois moins probable ; 0 : toujours le meilleur. */
  temperature: number;
  /** Note des états ; absente : la manuelle. */
  note?: Note;
}

/**
 * Difficulté croissante (étape 3 du design ai-better-brain). Riposte à 0
 * partout : mesurée nuisible lors du réglage de STRONGEST.
 */
export const LEVEL_BRAINS: Record<AiLevel, LevelBrain> = {
  1: { thinking: 'greedy', temperature: 200 },
  2: { thinking: 'greedy', temperature: 100 },
  3: {
    thinking: {
      beamWidth: 3,
      depth: 6,
      ripostes: 0,
      budget: 1500,
      timeLimitMs: 800,
    },
    temperature: 30,
  },
  4: {
    thinking: {
      beamWidth: 6,
      depth: 9,
      ripostes: 0,
      budget: 4000,
      timeLimitMs: 1500,
    },
    temperature: 10,
  },
  5: {
    thinking: { ...STRONGEST, timeLimitMs: 2500 },
    temperature: 0,
  },
};

/** L'IA d'un combat d'aventure, au cerveau de son niveau. */
export function createLevelAi(
  engine: GameEngine,
  level: AiLevel,
  random: () => number = Math.random,
): AiPlayer {
  const { thinking, temperature, note } = LEVEL_BRAINS[level];
  return new AiPlayer(
    engine,
    random,
    thinking,
    temperature,
    evaluatorOf(note ?? defaultNote()),
  );
}
