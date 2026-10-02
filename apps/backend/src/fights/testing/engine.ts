import { GameEngine } from '../engine/game-engine';
import { EffectsResolverService } from '../effects-resolver.service';
import { BuffsCalculatorService } from '../buffs-calculator.service';
import { PhaseService } from '../services/phase.service';
import { SummonService } from '../services/summon.service';
import { SupportService } from '../services/support.service';
import { BattleService } from '../services/battle.service';
import { PickService } from '../services/pick.service';

/** Moteur câblé à la main, comme le ferait Nest, pour les tests. */
export function createEngine(): GameEngine {
  const effects = new EffectsResolverService();
  const buffs = new BuffsCalculatorService();
  return new GameEngine(
    new PhaseService(effects, buffs),
    new SummonService(effects, buffs),
    new SupportService(effects, buffs),
    new BattleService(effects, buffs),
    new PickService(effects),
  );
}
