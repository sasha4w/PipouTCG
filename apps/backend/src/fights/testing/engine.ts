import type { GameEngine } from '../engine/game-engine';
import type { Rng } from '../engine/rng';
import { createAiEngine } from '../ai/ai-engine';
import { setEvolutionCatalog } from '../helpers/evolution-catalog';
import { fixedRng } from './fixed-rng';
import { allRealCards } from './real-cards';

/** Moteur câblé à la main, comme le ferait Nest, pour les tests. */
export function createEngine(rng: Rng = fixedRng()): GameEngine {
  setEvolutionCatalog(allRealCards());
  return createAiEngine(rng);
}
