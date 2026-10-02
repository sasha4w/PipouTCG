import { Injectable } from '@nestjs/common';
import { EffectTrigger } from '@pipou/shared';
import {
  CardInstance,
  GameState,
  MonsterOnBoard,
  PlayerGameState,
} from './interfaces/game-state.interface';
import type { EffectContext } from './effects/effect-context.interface';
import { checkCondition } from './effects/effect-conditions';
import { applyActions } from './effects/effect-actions.applier';
import { drawCard } from './helpers/game-state.helper';

export type { EffectContext };

/**
 * EffectsResolverService — orchestrateur des effets de cartes.
 *
 * Conditions → effects/effect-conditions.ts
 * Cibles     → effects/effect-targets.resolver.ts (dans l'applier)
 * Actions    → effects/effect-actions.applier.ts
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

    const effectCtx: EffectContext = { ...ctx, sourceCard: card };
    let changed = false;
    for (const effect of effects) {
      if (effect.trigger !== trigger) continue;
      if (!checkCondition(effect, effectCtx)) continue;
      applyActions(effect, card, effectCtx, (host, instanceId) =>
        this.destroyMonster(ctx.game, host, instanceId, ctx.log, {
          // Sacrifice par son propre effet : pas de pioche
          draw: host.userId !== ctx.ownerUserId,
        }),
      );
      changed = true;
    }
    return changed;
  }

  /**
   * Détruit un monstre : ON_DEATH (monstre encore en jeu), puis monstre et
   * équipements au cimetière de l'hôte, puis pioche de l'hôte si demandée.
   */
  destroyMonster(
    game: GameState,
    host: PlayerGameState,
    instanceId: string,
    log: string[],
    opts: { draw: boolean },
  ): MonsterOnBoard | null {
    const monster = host.monsterZones.find((m) => m?.instanceId === instanceId);
    if (!monster) return null;

    this.resolve(monster.card, EffectTrigger.ON_DEATH, {
      game,
      ownerUserId: host.userId,
      sourceMonster: monster,
      log,
    });

    const idx = host.monsterZones.findIndex(
      (m) => m?.instanceId === instanceId,
    );
    if (idx !== -1) host.monsterZones[idx] = null;
    host.graveyard.push(...monster.equipments, monster.card);
    if (opts.draw) drawCard(game, host.userId);
    return monster;
  }
}
