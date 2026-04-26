import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { GameState, CardInstance, PlayerGameState } from '../interfaces/game-state.interface';
import { CardType } from '../../cards/enums/cardtype.enum';
import { SupportType } from '../../cards/enums/support-type.enum';
import {
  EffectTrigger,
  ConditionType,
} from '../../cards/interfaces/card-effect.interface';
import { EffectsResolverService } from '../effects-resolver.service';
import { BuffsCalculatorService } from '../buffs-calculator.service';
import {
  addLog,
  getPlayerState,
  isCurrentPlayer,
  drawCard,
} from '../helpers/game-state.helper';
import { CombatMode } from '../interfaces/game-state.interface';

@Injectable()
export class SupportService {
  constructor(
    private effectsResolver: EffectsResolverService,
    private buffsCalc: BuffsCalculatorService,
  ) {}

  async playSupport(
    game: GameState,
    userId: number,
    handIndex: number,
    zoneIndex: number | undefined,
    targetInstanceId: string | undefined,
    server: Server,
    checkWinAndEmit: (game: GameState, server: Server) => Promise<void>,
  ): Promise<{ error?: string }> {
    if (!isCurrentPlayer(game, userId)) return { error: "Ce n'est pas ton tour" };
    if (game.phase !== 'main') return { error: 'Phase principale uniquement' };

    const player = getPlayerState(game, userId);
    if (handIndex < 0 || handIndex >= player.hand.length)
      return { error: 'Index main invalide' };

    const card = player.hand[handIndex];
    if (card.baseCard.type !== CardType.SUPPORT) return { error: 'Pas un Support' };

    if (card.baseCard.supportType === SupportType.EPHEMERAL) {
      if (!this.isSupportPlayable(card, player, game))
        return { error: 'Condition non remplie pour jouer cette carte' };
    }

    const [support] = player.hand.splice(handIndex, 1);
    const log: string[] = [];

    switch (support.baseCard.supportType) {
      case SupportType.EPHEMERAL: {
        player.graveyard.push(support);
        addLog(game, `${player.username} joue ${support.baseCard.name}`);
        this.effectsResolver.resolve(support, EffectTrigger.ON_PLAY, {
          game, ownerUserId: userId, log,
        });
        break;
      }

      case SupportType.EQUIPMENT: {
        if (!targetInstanceId) {
          player.hand.splice(handIndex, 0, support);
          return { error: 'Cible requise pour un Équipement' };
        }
        const target = player.monsterZones.find((m) => m?.instanceId === targetInstanceId);
        if (!target) {
          player.hand.splice(handIndex, 0, support);
          return { error: 'Monstre cible introuvable' };
        }
        target.equipments.push(support);
        addLog(game, `${player.username} équipe ${support.baseCard.name} sur ${target.card.baseCard.name}`);
        this.effectsResolver.resolve(support, EffectTrigger.ON_PLAY, {
          game, ownerUserId: userId, sourceMonster: target, log,
        });
        this.buffsCalc.recalculate(player);
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
        addLog(game, `${player.username} pose ${support.baseCard.name} en zone ${zoneIndex}`);
        this.effectsResolver.resolve(support, EffectTrigger.ON_PLAY, {
          game, ownerUserId: userId, log,
        });
        this.buffsCalc.recalculate(player);
        break;
      }

      default:
        player.hand.splice(handIndex, 0, support);
        return { error: 'Type de support inconnu' };
    }

    log.forEach((l) => addLog(game, l));
    await checkWinAndEmit(game, server);
    return {};
  }

  async recycleFromHand(
    game: GameState,
    userId: number,
    handIndex: number,
    server: Server,
    emitState: (game: GameState, server: Server) => void,
  ): Promise<{ error?: string }> {
    if (!isCurrentPlayer(game, userId)) return { error: "Ce n'est pas ton tour" };
    if (game.phase !== 'main') return { error: 'Phase principale uniquement' };

    const player = getPlayerState(game, userId);
    if (handIndex < 0 || handIndex >= player.hand.length)
      return { error: 'Index main invalide' };

    const [card] = player.hand.splice(handIndex, 1);
    player.graveyard.push(card);

    if (card.baseCard.id === 17) {
      const drawn = drawCard(game, userId);
      if (drawn) addLog(game, `🎺 Clairon recyclé — ${player.username} pioche une carte`);
    }
    player.recycleEnergy += 1;
    addLog(game, `♻️ ${player.username} recycle ${card.baseCard.name} → +1 énergie (${player.recycleEnergy} total)`);

    emitState(game, server);
    return {};
  }

  async changeMode(
    game: GameState,
    userId: number,
    instanceId: string,
    mode: CombatMode,
    server: Server,
    emitState: (game: GameState, server: Server) => void,
  ): Promise<{ error?: string }> {
    if (!isCurrentPlayer(game, userId)) return { error: "Ce n'est pas ton tour" };
    if (game.phase !== 'main') return { error: 'Changement de mode en phase principale uniquement' };

    const player = getPlayerState(game, userId);
    const monster = player.monsterZones.find((m) => m?.instanceId === instanceId);
    if (!monster) return { error: 'Monstre introuvable' };
    if (monster.forcedAttackMode && mode === 'guard')
      return { error: 'Ce monstre ne peut pas passer en mode Garde' };

    monster.mode = mode;
    addLog(game, `${player.username} : ${monster.card.baseCard.name} → mode ${mode === 'attack' ? 'Attaque ⚔️' : 'Garde 🛡️'}`);
    emitState(game, server);
    return {};
  }

  private isSupportPlayable(card: CardInstance, player: PlayerGameState, game: GameState): boolean {
    const effects = card.baseCard.effects;
    if (!effects?.length) return true;

    for (const effect of effects) {
      if (effect.trigger !== EffectTrigger.ON_PLAY) continue;
      if (!effect.condition) return true;

      switch (effect.condition.type) {
        case ConditionType.ARCHETYPE_ON_BOARD: {
          const arch = effect.condition.value as string;
          const hasOnBoard = player.monsterZones.some(
            (m) => m?.card.baseCard.archetype?.toLowerCase() === arch.toLowerCase(),
          );
          if (!hasOnBoard) return false;
          break;
        }
        case ConditionType.HAND_SIZE_MIN:
          if (player.hand.length < (effect.condition.value as number)) return false;
          break;
        default:
          return true;
      }
    }
    return true;
  }
}
