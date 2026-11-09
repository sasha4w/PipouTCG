import { Injectable } from '@nestjs/common';
import {
  GameState,
  CardInstance,
  ChoiceCandidate,
  MonsterOnBoard,
} from '../interfaces/game-state.interface';
import {
  CardType,
  Immunity,
  hasImmunity,
  DrakonStage,
  SupportType,
  canPlaceInSupportZone,
  canEquip,
  canTransform,
  EffectTrigger,
  ephemeralDestroysChosenTarget,
  ephemeralTargetSide,
  isBoardPhase,
  isImplanted,
  isPlantedBy,
  isTargetableByEphemeral,
} from '@pipou/shared';
import { checkCondition } from '../effects/effect-conditions';
import { canResolveAction } from '../effects/effect-resolvability';
import { EffectsResolverService } from '../effects-resolver.service';
import {
  addLog,
  getPlayerState,
  getOpponentState,
  isCurrentPlayer,
  leaveGuard,
  queueChoice,
  sendToGraveyard,
} from '../helpers/game-state.helper';
import { CombatMode } from '../interfaces/game-state.interface';
import { missingRequirement } from '../helpers/support-requirements';

@Injectable()
export class SupportService {
  constructor(private effectsResolver: EffectsResolverService) {}

  playSupport(
    game: GameState,
    userId: number,
    handIndex: number,
    zoneIndex: number | undefined,
    targetInstanceId: string | undefined,
    replaceInstanceId: string | undefined,
  ): { error?: string } {
    if (!isCurrentPlayer(game, userId))
      return { error: "Ce n'est pas ton tour" };
    if (!isBoardPhase(game.phase))
      return { error: 'Phase principale ou de contrôle uniquement' };

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
        // Un monstre implanté n'est jamais « allié » de son hôte, ni « ennemi » de son poseur
        const pool = (
          side === 'ally'
            ? player.monsterZones
            : getOpponentState(game, userId).monsterZones
        ).filter(
          (m): m is MonsterOnBoard =>
            m !== null &&
            (side === 'ally'
              ? !isImplanted(m, userId)
              : !isPlantedBy(m, userId)),
        );
        const targetable = pool.filter((m) =>
          isTargetableByEphemeral(m, side, card.baseCard.effects),
        );
        if (targetable.length === 0)
          return { error: 'Aucune cible valide pour cette carte' };
        const chosen = pool.find((m) => m.instanceId === targetInstanceId);
        if (chosen && !targetable.includes(chosen))
          return {
            error:
              side === 'enemy' && hasImmunity(chosen, Immunity.SUPPORT_DEBUFF)
                ? 'Ce monstre est insensible aux effets adverses'
                : ephemeralDestroysChosenTarget(card.baseCard.effects) &&
                    hasImmunity(chosen, Immunity.SUPPORT_DESTRUCTION)
                  ? 'Ce monstre ne peut pas être détruit par une carte Support'
                  : "Cette carte n'aurait aucun effet sur ce monstre",
          };
        targetMonster = chosen;
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
        // Mes monstres (hors implantés chez moi) ou ceux que j'ai implantés chez l'adversaire
        const target = [
          ...player.monsterZones.filter((m) => m && !isImplanted(m, userId)),
          ...getOpponentState(game, userId).monsterZones.filter(
            (m) => m && isPlantedBy(m, userId),
          ),
        ].find((m) => m?.instanceId === targetInstanceId);
        if (!target) {
          player.hand.splice(handIndex, 0, support);
          return { error: 'Monstre cible introuvable' };
        }
        const check = canEquip(target.equipments, support.baseCard);
        const undo = (error: string) => {
          player.hand.splice(handIndex, 0, support);
          return { error };
        };
        if (check.kind === 'no_slot')
          return undo('Équipement sans emplacement');
        if (check.kind === 'duplicate')
          return undo('Ce monstre porte déjà cet accessoire');
        if (check.kind === 'slot_full') {
          if (!replaceInstanceId)
            return undo('Emplacement plein : confirme le remplacement');
          if (!check.replaceable.includes(replaceInstanceId))
            return undo('Équipement à remplacer introuvable');
          const idx = target.equipments.findIndex(
            (e) => e.instanceId === replaceInstanceId,
          );
          const [old] = target.equipments.splice(idx, 1);
          sendToGraveyard(player, old);
          addLog(game, `${old.baseCard.name} est remplacé`);
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

      case SupportType.PERSISTENT:
      case SupportType.CHARGE: {
        const placement = canPlaceInSupportZone(
          player.supportZones,
          support.baseCard,
        );
        const undo = (error: string) => {
          player.hand.splice(handIndex, 0, support);
          return { error };
        };
        if (placement.kind === 'duplicate')
          return undo('Cette carte est déjà en jeu');
        if (placement.kind === 'full') return undo('Zones support pleines');
        const missing = missingRequirement(support, player);
        if (missing) return undo(`Il faut ${missing} sur le terrain`);

        let zone: number;
        if (placement.kind === 'replace_terrain') {
          const old = player.supportZones[placement.zoneIndex]!;
          if (replaceInstanceId !== old.instanceId)
            return undo('Confirme le remplacement de ton Terrain');
          player.supportZones[placement.zoneIndex] = null;
          sendToGraveyard(player, old);
          addLog(game, `${player.username} remplace ${old.baseCard.name}`);
          zone = placement.zoneIndex;
        } else {
          if (zoneIndex === undefined || zoneIndex < 0 || zoneIndex > 2)
            return undo('Zone invalide (0-2)');
          if (player.supportZones[zoneIndex])
            return undo('Zone de support occupée');
          zone = zoneIndex;
        }

        support.placedSeq = ++game.supportSeq;
        if (support.baseCard.supportType === SupportType.CHARGE)
          support.chargeCounters = 0;
        player.supportZones[zone] = support;
        game.pendingEvents.push({
          kind: 'support_placed',
          ownerId: player.userId,
          zoneIndex: zone,
          instanceId: support.instanceId,
        });
        addLog(
          game,
          `${player.username} pose ${support.baseCard.name} en zone ${zone}`,
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

  /**
   * Défausse un Jeune/Adulte coincé en main pour récupérer le Bébé de sa
   * lignée (deck ou cimetière, au choix). Gratuit, une fois par tour.
   */
  transformFromHand(
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

    const card = player.hand[handIndex];
    if (!canTransform(card.baseCard))
      return { error: 'Seul un Jeune ou un Adulte peut se transformer' };
    if (player.transformUsedThisTurn)
      return { error: 'Une seule transformation par tour' };

    const lineage = card.baseCard.lineage;
    const lineageLabel = lineage
      ? lineage.charAt(0).toUpperCase() + lineage.slice(1)
      : '';
    const isBaby = (c: CardInstance) =>
      c.baseCard.stage === DrakonStage.BABY && c.baseCard.lineage === lineage;
    const toCandidates = (
      pile: CardInstance[],
      source: 'graveyard' | 'deck',
    ): ChoiceCandidate[] =>
      pile.filter(isBaby).map((c) => ({
        instanceId: c.instanceId,
        baseCard: c.baseCard,
        source,
      }));
    const candidates = [
      ...toCandidates(player.graveyard, 'graveyard'),
      ...toCandidates(player.deck, 'deck'),
    ];
    if (candidates.length === 0)
      return { error: `Aucun Bébé ${lineageLabel} à récupérer` };

    player.hand.splice(handIndex, 1);
    player.graveyard.push(card);
    player.transformUsedThisTurn = true;
    addLog(
      game,
      `🔁 ${player.username} défausse ${card.baseCard.name} pour récupérer un Bébé ${lineageLabel}`,
    );
    queueChoice(game, {
      forUserId: userId,
      candidates,
      count: 1,
      prompt: `Choisissez le Bébé ${lineageLabel} à récupérer (cimetière ou deck)`,
      promptKey: 'baby_lineage',
      promptParams: { lineage: lineageLabel },
      resolution: 'pick_to_hand',
    });
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
    if (isImplanted(monster, userId))
      return {
        error: `${monster.card.baseCard.name} appartient à ton adversaire`,
      };

    if (monster.forcedAttackMode && mode === 'guard')
      return { error: 'Ce monstre ne peut pas passer en mode Garde' };

    if (monster.guardLocked) {
      return {
        error: `${monster.card.baseCard.name} est verrouillé en mode Garde`,
      };
    }

    // Le temps s'achète, il ne s'accumule pas : pas de retour en Garde le tour de la sortie
    if (mode === 'guard' && monster.guardCooldown)
      return {
        error: `${monster.card.baseCard.name} vient de sortir de la Garde : retour possible au prochain tour`,
      };
    // Sortir de la Garde : contre-offensive ; y entrer : le compteur repart de zéro
    if (mode === 'attack' && monster.mode === 'guard') leaveGuard(monster);
    else if (mode === 'guard') monster.guardTurns = 0;
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
