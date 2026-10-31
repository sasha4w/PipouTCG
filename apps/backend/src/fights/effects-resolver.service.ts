import { Injectable } from '@nestjs/common';
import {
  CardType,
  DestroyCause,
  EffectTrigger,
  Immunity,
  hasImmunity,
} from '@pipou/shared';
import {
  CardInstance,
  GameState,
  MonsterOnBoard,
  PlayerGameState,
} from './interfaces/game-state.interface';
import type { EffectContext } from './effects/effect-context.interface';
import { checkCondition } from './effects/effect-conditions';
import { applyActions } from './effects/effect-actions.applier';
import {
  drawCard,
  getPlayerState,
  boardCard,
  sendToGraveyard,
} from './helpers/game-state.helper';

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
      applyActions(
        effect,
        card,
        effectCtx,
        (host, instanceId, kind) => {
          const target = host.monsterZones.find(
            (m) => m?.instanceId === instanceId,
          );
          if (
            kind === 'destroy' &&
            card.baseCard.type === CardType.SUPPORT &&
            target &&
            hasImmunity(target, Immunity.SUPPORT_DESTRUCTION)
          ) {
            ctx.log.push(
              `🧱 ${target.card.baseCard.name} résiste à la destruction`,
            );
            return;
          }
          // Son propre monstre détruit par son propre effet : sacrifice, sans pioche
          const sacrifice = host.userId === ctx.ownerUserId;
          this.destroyMonster(ctx.game, host, instanceId, ctx.log, {
            draw: !sacrifice,
            cause: sacrifice ? DestroyCause.SACRIFICE : DestroyCause.EFFECT,
          });
        },
        (owner, monster) => {
          // Copie apparue en jeu : son ON_SUMMON se déclenche comme à une invocation
          this.resolve(monster.card, EffectTrigger.ON_SUMMON, {
            game: ctx.game,
            ownerUserId: owner.userId,
            sourceMonster: monster,
            log: ctx.log,
          });
        },
      );
      changed = true;
    }
    return changed;
  }

  /**
   * Détruit un monstre : événement de destruction, ON_DEATH (monstre encore en
   * jeu), puis monstre et équipements au cimetière de l'hôte, puis pioche de
   * l'hôte si demandée.
   */
  destroyMonster(
    game: GameState,
    host: PlayerGameState,
    instanceId: string,
    log: string[],
    opts: { draw: boolean; cause: DestroyCause },
  ): MonsterOnBoard | null {
    const zoneIndex = host.monsterZones.findIndex(
      (m) => m?.instanceId === instanceId,
    );
    const monster = host.monsterZones[zoneIndex];
    if (!monster) return null;

    // Avant ON_DEATH : les morts en chaîne suivent dans l'ordre
    game.pendingEvents.push({
      kind: 'monster_destroyed',
      ownerId: host.userId,
      zoneIndex,
      instanceId,
      cause: opts.cause,
    });

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
    // Monstre implanté : la carte rejoint le cimetière de son poseur, et chaque
    // équipement celui de son propriétaire (le poseur à défaut)
    const poserId = monster.ownerUserId ?? host.userId;
    if (poserId === host.userId) {
      sendToGraveyard(host, ...monster.equipments, boardCard(monster));
    } else {
      const poser = getPlayerState(game, poserId);
      sendToGraveyard(poser, boardCard(monster));
      for (const equipment of monster.equipments)
        sendToGraveyard(
          equipment.ownerId === host.userId ? host : poser,
          equipment,
        );
    }
    if (opts.draw) drawCard(game, host.userId);
    return monster;
  }
}
