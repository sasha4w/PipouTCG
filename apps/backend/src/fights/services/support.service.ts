import { Injectable } from '@nestjs/common';
import {
  GameState,
  CardInstance,
  MonsterOnBoard,
} from '../interfaces/game-state.interface';
import {
  CardType,
  SupportType,
  EffectTrigger,
  ephemeralTargetSide,
} from '@pipou/shared';
import { checkCondition } from '../effects/effect-conditions';
import { canResolveAction } from '../effects/effect-resolvability';
import { EffectsResolverService } from '../effects-resolver.service';
import {
  addLog,
  getPlayerState,
  getOpponentState,
  isCurrentPlayer,
} from '../helpers/game-state.helper';
import { CombatMode } from '../interfaces/game-state.interface';

@Injectable()
export class SupportService {
  constructor(private effectsResolver: EffectsResolverService) {}

  playSupport(
    game: GameState,
    userId: number,
    handIndex: number,
    zoneIndex: number | undefined,
    targetInstanceId: string | undefined,
  ): { error?: string } {
    if (!isCurrentPlayer(game, userId))
      return { error: "Ce n'est pas ton tour" };
    if (game.phase !== 'main') return { error: 'Phase principale uniquement' };

    const player = getPlayerState(game, userId);
    if (handIndex < 0 || handIndex >= player.hand.length)
      return { error: 'Index main invalide' };

    const card = player.hand[handIndex];
    if (card.baseCard.type !== CardType.SUPPORT)
      return { error: 'Pas un Support' };

    let targetMonster: MonsterOnBoard | undefined;
    if (card.baseCard.supportType === SupportType.EPHEMERAL) {
      const unplayable = this.unplayableReason(game, card, userId);
      if (unplayable) return { error: unplayable };

      const side = ephemeralTargetSide(card.baseCard.effects);
      if (side) {
        const pool =
          side === 'ally'
            ? player.monsterZones
            : getOpponentState(game, userId).monsterZones;
        if (!pool.some((m) => m !== null))
          return { error: 'Aucune cible valide pour cette carte' };
        targetMonster =
          pool.find((m) => m?.instanceId === targetInstanceId) ?? undefined;
        if (!targetMonster)
          return {
            error:
              side === 'ally'
                ? 'Choisis un de tes monstres comme cible'
                : 'Choisis un monstre adverse comme cible',
          };
      }
    }

    const [support] = player.hand.splice(handIndex, 1);
    const log: string[] = [];

    switch (support.baseCard.supportType) {
      case SupportType.EPHEMERAL: {
        player.graveyard.push(support);
        addLog(game, `${player.username} joue ${support.baseCard.name}`);
        this.effectsResolver.resolve(support, EffectTrigger.ON_PLAY, {
          game,
          ownerUserId: userId,
          targetMonster,
          log,
        });
        break;
      }

      case SupportType.EQUIPMENT: {
        if (!targetInstanceId) {
          player.hand.splice(handIndex, 0, support);
          return { error: 'Cible requise pour un Équipement' };
        }
        const target = player.monsterZones.find(
          (m) => m?.instanceId === targetInstanceId,
        );
        if (!target) {
          player.hand.splice(handIndex, 0, support);
          return { error: 'Monstre cible introuvable' };
        }
        target.equipments.push(support);
        addLog(
          game,
          `${player.username} équipe ${support.baseCard.name} sur ${target.card.baseCard.name}`,
        );
        this.effectsResolver.resolve(support, EffectTrigger.ON_PLAY, {
          game,
          ownerUserId: userId,
          sourceMonster: target,
          log,
        });

        break;
      }

      case SupportType.TERRAIN: {
        if (zoneIndex === undefined || zoneIndex < 0 || zoneIndex > 2) {
          player.hand.splice(handIndex, 0, support);
          return { error: 'Zone invalide (0-2)' };
        }
        if (player.supportZones[zoneIndex]) {
          player.hand.splice(handIndex, 0, support);
          return { error: 'Zone de support occupée' };
        }
        player.supportZones[zoneIndex] = support;
        addLog(
          game,
          `${player.username} pose ${support.baseCard.name} en zone ${zoneIndex}`,
        );
        this.effectsResolver.resolve(support, EffectTrigger.ON_PLAY, {
          game,
          ownerUserId: userId,
          log,
        });

        break;
      }

      default:
        player.hand.splice(handIndex, 0, support);
        return { error: 'Type de support inconnu' };
    }

    log.forEach((l) => addLog(game, l));
    return {};
  }

  recycleFromHand(
    game: GameState,
    userId: number,
    handIndex: number,
  ): { error?: string } {
    if (!isCurrentPlayer(game, userId))
      return { error: "Ce n'est pas ton tour" };
    if (game.phase !== 'main') return { error: 'Phase principale uniquement' };

    const player = getPlayerState(game, userId);
    if (handIndex < 0 || handIndex >= player.hand.length)
      return { error: 'Index main invalide' };

    const [card] = player.hand.splice(handIndex, 1);
    player.graveyard.push(card);

    player.recycleEnergy += 1;
    addLog(
      game,
      `♻️ ${player.username} recycle ${card.baseCard.name} → +1 énergie (${player.recycleEnergy} total)`,
    );

    const log: string[] = [];
    this.effectsResolver.resolve(card, EffectTrigger.ON_RECYCLE, {
      game,
      ownerUserId: userId,
      log,
    });
    log.forEach((l) => addLog(game, l));
    return {};
  }

  changeMode(
    game: GameState,
    userId: number,
    instanceId: string,
    mode: CombatMode,
  ): { error?: string } {
    if (!isCurrentPlayer(game, userId))
      return { error: "Ce n'est pas ton tour" };
    if (game.phase !== 'main')
      return { error: 'Changement de mode en phase principale uniquement' };

    const player = getPlayerState(game, userId);
    const monster = player.monsterZones.find(
      (m) => m?.instanceId === instanceId,
    );
    if (!monster) return { error: 'Monstre introuvable' };

    if (monster.forcedAttackMode && mode === 'guard')
      return { error: 'Ce monstre ne peut pas passer en mode Garde' };

    if (monster.guardLocked) {
      return {
        error: `${monster.card.baseCard.name} est verrouillé en mode Garde`,
      };
    }

    monster.mode = mode;
    addLog(
      game,
      `${player.username} : ${monster.card.baseCard.name} → mode ${mode === 'attack' ? 'Attaque ⚔️' : 'Garde 🛡️'}`,
    );
    return {};
  }

  /**
   * Raison pour laquelle un Éphémère ne peut pas être joué, ou null.
   * Il faut qu'au moins un effet ON_PLAY ait sa condition remplie, et que
   * l'un d'eux puisse produire quelque chose (sinon la carte serait gâchée).
   */
  private unplayableReason(
    game: GameState,
    card: CardInstance,
    userId: number,
  ): string | null {
    const onPlay = (card.baseCard.effects ?? []).filter(
      (e) => e.trigger === EffectTrigger.ON_PLAY,
    );
    if (onPlay.length === 0) return null;

    const ctx = { game, ownerUserId: userId, sourceCard: card, log: [] };
    const active = onPlay.filter((e) => checkCondition(e, ctx));
    if (active.length === 0)
      return 'Condition non remplie pour jouer cette carte';
    if (!active.some((e) => e.actions.some((a) => canResolveAction(a, ctx))))
      return "Cette carte n'aurait aucun effet pour l'instant";
    return null;
  }
}
