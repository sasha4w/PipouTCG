import { GameEngine } from '../engine/game-engine';
import type { Rng } from '../engine/rng';
import { EffectsResolverService } from '../effects-resolver.service';
import { BuffsCalculatorService } from '../buffs-calculator.service';
import { PhaseService } from '../services/phase.service';
import { SummonService } from '../services/summon.service';
import { SupportService } from '../services/support.service';
import { BattleService } from '../services/battle.service';
import { PickService } from '../services/pick.service';
import { fixedRng } from './fixed-rng';

/** Moteur câblé à la main, comme le ferait Nest, pour les tests. */
export function createEngine(rng: Rng = fixedRng()): GameEngine {
  const effects = new EffectsResolverService();
  return new GameEngine(
    new PhaseService(effects),
    new SummonService(effects),
    new SupportService(effects),
    new BattleService(effects),
    new PickService(effects),
    effects,
    new BuffsCalculatorService(),
    rng,
  );
}
