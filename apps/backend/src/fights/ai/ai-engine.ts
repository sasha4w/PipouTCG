import { BuffsCalculatorService } from '../buffs-calculator.service';
import { EffectsResolverService } from '../effects-resolver.service';
import { GameEngine } from '../engine/game-engine';
import { mathRandomRng } from '../engine/rng';
import type { Rng } from '../engine/rng';
import { BattleService } from '../services/battle.service';
import { EvolutionService } from '../services/evolution.service';
import { PhaseService } from '../services/phase.service';
import { PickService } from '../services/pick.service';
import { SummonService } from '../services/summon.service';
import { SupportService } from '../services/support.service';

/** Moteur câblé à la main, comme le ferait Nest (worker d'IA, outils, tests). */
export function createAiEngine(rng: Rng = mathRandomRng): GameEngine {
  const effects = new EffectsResolverService();
  const summon = new SummonService(effects);
  return new GameEngine(
    new PhaseService(effects),
    summon,
    new EvolutionService(effects),
    new SupportService(effects),
    new BattleService(effects),
    new PickService(summon, effects),
    effects,
    new BuffsCalculatorService(),
    rng,
  );
}
