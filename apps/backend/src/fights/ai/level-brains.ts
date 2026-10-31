import type { GameEngine } from '../engine/game-engine';
import { AiPlayer } from './ai-player';
import type { AiLevel } from './ai-player';
import { STRONGEST } from './planner';
import type { ThinkingProfile } from './planner';

/** Cerveau d'un niveau d'aventure : façon de réfléchir et taux d'erreur. */
export interface LevelBrain {
  thinking: ThinkingProfile | 'greedy';
  mistakeRate: number;
}

/** Plafond de temps d'une décision en aventure. */
const AI_TIME_LIMIT_MS = 200;

/**
 * Difficulté croissante (étape 3 du design ai-better-brain). Riposte à 0
 * partout : mesurée nuisible lors du réglage de STRONGEST.
 */
export const LEVEL_BRAINS: Record<AiLevel, LevelBrain> = {
  1: { thinking: 'greedy', mistakeRate: 0.25 },
  2: { thinking: 'greedy', mistakeRate: 0.1 },
  3: {
    thinking: {
      beamWidth: 3,
      depth: 6,
      ripostes: 0,
      budget: 1500,
      timeLimitMs: AI_TIME_LIMIT_MS,
    },
    mistakeRate: 0,
  },
  4: {
    thinking: {
      beamWidth: 6,
      depth: 9,
      ripostes: 0,
      budget: 4000,
      timeLimitMs: AI_TIME_LIMIT_MS,
    },
    mistakeRate: 0,
  },
  5: {
    thinking: { ...STRONGEST, timeLimitMs: AI_TIME_LIMIT_MS },
    mistakeRate: 0,
  },
};

/** L'IA d'un combat d'aventure, au cerveau de son niveau. */
export function createLevelAi(
  engine: GameEngine,
  level: AiLevel,
  random: () => number = Math.random,
): AiPlayer {
  const { thinking, mistakeRate } = LEVEL_BRAINS[level];
  return new AiPlayer(engine, random, thinking, mistakeRate);
}
