import { Injectable } from '@nestjs/common';
import { EffectTrigger } from '../cards/interfaces/card-effect.interface';
import {
  CardInstance,
  MonsterOnBoard,
  PlayerGameState,
} from './interfaces/game-state.interface';
import type { EffectContext } from './effects/effect-context.interface';
import { checkCondition } from './effects/effect-conditions';
import { applyActions } from './effects/effect-actions.applier';

export type { EffectContext };

/**
 * EffectsResolverService — thin orchestrator.
 *
 * Condition checking  → effects/effect-conditions.ts
 * Target resolution   → effects/effect-targets.resolver.ts  (used inside applier)
 * Action application  → effects/effect-actions.applier.ts
 */
@Injectable()
export class EffectsResolverService {
  resolve(
    card: CardInstance,
    trigger: EffectTrigger,
    ctx: EffectContext,
  ): boolean {
    const effects = card.baseCard.effects;
    if (!effects?.length) return false;

    let changed = false;
    for (const effect of effects) {
      if (effect.trigger !== trigger) continue;
      if (checkCondition(effect, ctx)) {
        applyActions(effect, card, ctx, this.killMonster.bind(this));
        changed = true;
      }
    }
    return changed;
  }

  // ─── Private: monster death (kept here because it calls resolve recursively) ──

  private killMonster(
    instanceId: string,
    owner: PlayerGameState,
    ctx: EffectContext,
  ): void {
    const idx = owner.monsterZones.findIndex(
      (m) => m?.instanceId === instanceId,
    );
    if (idx === -1) return;
    const monster = owner.monsterZones[idx]!;
    owner.graveyard.push(...monster.equipments, monster.card);
    owner.monsterZones[idx] = null;
    const draw = owner.deck.shift();
    if (draw) owner.hand.push(draw);
    this.resolve(monster.card, EffectTrigger.ON_DEATH, {
      ...ctx,
      ownerUserId: owner.userId,
      sourceMonster: monster,
    });
  }
}
