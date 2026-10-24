import { Injectable } from '@nestjs/common';
import {
  CardInstance,
  GameState,
  PlayerGameState,
} from '../interfaces/game-state.interface';
import { createMonsterOnBoard } from '../helpers/monster.factory';
import {
  Archetype,
  CardType,
  DestroyCause,
  EffectTrigger,
  canSummonFromHand,
  canImplantOn,
  canSummonOnEnemySide,
  isImplanted,
  graveyardHasAllElements,
  releveCount,
  requiresAllElements,
} from '@pipou/shared';
import { EffectsResolverService } from '../effects-resolver.service';
import {
  addLog,
  getPlayerState,
  getOpponentState,
  isCurrentPlayer,
} from '../helpers/game-state.helper';

@Injectable()
export class SummonService {
  constructor(private effectsResolver: EffectsResolverService) {}

  /** Invoque un monstre de la main, sur son terrain ou sur une zone adverse libre. */
  summon(
    game: GameState,
    userId: number,
    handIndex: number,
    zoneIndex: number,
    paymentHandIndices: number[],
    onOpponentSide: boolean,
    releveInstanceIds?: string[],
  ): { error?: string } {
    if (onOpponentSide) {
      const card = getPlayerState(game, userId).hand[handIndex];
      if (!card) return { error: 'Index main invalide' };
      if (!canSummonOnEnemySide(card.baseCard.effects))
        return {
          error: `${card.baseCard.name} ne peut pas être invoqué sur le terrain adverse`,
        };
      if (!canImplantOn(getOpponentState(game, userId).monsterZones, userId))
        return { error: "Un seul Zeta à la fois chez l'adversaire" };
    }
    return this.doSummon(
      game,
      userId,
      handIndex,
      zoneIndex,
      paymentHandIndices,
      onOpponentSide,
      releveInstanceIds,
    );
  }

  /** Invocation gratuite d'une carte (éclosion, invocation depuis le deck). */
  summonFromDeck(
    game: GameState,
    owner: PlayerGameState,
    card: CardInstance,
    preferredZone?: number,
    opts: { fromEgg?: boolean } = {},
  ): boolean {
    const zone =
      preferredZone !== undefined && !owner.monsterZones[preferredZone]
        ? preferredZone
        : owner.monsterZones.findIndex((z) => z === null);
    if (zone === -1) return false;
    const monster = createMonsterOnBoard(card);
    // Apparu pendant le tour adverse : pourra évoluer dès le tour suivant
    monster.summonedThisTurn = game.currentTurnUserId === owner.userId;
    // Sorti d'un œuf : peut évoluer le tour même
    if (opts.fromEgg) monster.canEvolveThisTurn = true;
    owner.monsterZones[zone] = monster;
    game.pendingEvents.push({
      kind: 'monster_summoned',
      ownerId: owner.userId,
      zoneIndex: zone,
      instanceId: monster.instanceId,
      rarity: card.baseCard.rarity,
    });
    addLog(game, `✨ ${card.baseCard.name} est invoqué gratuitement`);
    const log: string[] = [];
    this.effectsResolver.resolve(card, EffectTrigger.ON_SUMMON, {
      game,
      ownerUserId: owner.userId,
      sourceMonster: monster,
      log,
    });
    log.forEach((l) => addLog(game, l));
    return true;
  }

  // ── Logique commune ────────────────────────────────────────────────────────

  private doSummon(
    game: GameState,
    userId: number,
    handIndex: number,
    zoneIndex: number,
    paymentHandIndices: number[],
    onOpponentZone: boolean,
    releveInstanceIds?: string[],
  ): { error?: string } {
    if (!isCurrentPlayer(game, userId))
      return { error: "Ce n'est pas ton tour" };
    if (game.phase !== 'main') return { error: 'Phase principale uniquement' };

    const player = getPlayerState(game, userId);
    const opponent = getOpponentState(game, userId);
    const target = onOpponentZone ? opponent : player;

    if (zoneIndex < 0 || zoneIndex > 2) return { error: 'Zone invalide (0-2)' };
    // Relève : la zone d'un allié sacrifié se libère
    const occupant = target.monsterZones[zoneIndex];
    if (occupant && !releveInstanceIds?.includes(occupant.instanceId))
      return { error: 'Zone occupée' };
    if (handIndex < 0 || handIndex >= player.hand.length)
      return { error: 'Index main invalide' };

    const card = player.hand[handIndex];
    if (card.baseCard.type !== CardType.MONSTER)
      return { error: 'Pas un Monstre' };
    if (!canSummonFromHand(card.baseCard))
      return {
        error: `${card.baseCard.name} ne peut arriver en jeu que par évolution`,
      };

    if (
      requiresAllElements(card.baseCard.effects) &&
      !graveyardHasAllElements(player.graveyard.map((c) => c.baseCard))
    )
      return {
        error:
          'Il faut un Adulte ou un Ancestral de chaque élément au cimetière',
      };

    if (releveInstanceIds) {
      const error = this.releveError(player, card, releveInstanceIds);
      if (error) return { error };
      const log: string[] = [];
      addLog(
        game,
        `🎖️ Relève : ${releveInstanceIds.length} allié(s) cèdent leur place à ${card.baseCard.name}`,
      );
      for (const id of releveInstanceIds)
        this.effectsResolver.destroyMonster(game, player, id, log, {
          draw: false,
          cause: DestroyCause.SACRIFICE,
        });
      log.forEach((l) => addLog(game, l));
      return this.place(
        game,
        player,
        opponent,
        target,
        card,
        zoneIndex,
        onOpponentZone,
        userId,
      );
    }

    const isFree = player.freeSummonInstanceIds.includes(card.instanceId);
    if (isFree)
      player.freeSummonInstanceIds = player.freeSummonInstanceIds.filter(
        (id) => id !== card.instanceId,
      );

    const cost = isFree ? 0 : (card.baseCard.cost ?? 0);
    const uniquePayment = isFree ? [] : [...new Set(paymentHandIndices)];
    const handPayNeeded = isFree ? 0 : Math.max(0, cost - player.recycleEnergy);

    if (uniquePayment.length < handPayNeeded)
      return {
        error: `Pas assez de cartes défaussées (besoin: ${handPayNeeded})`,
      };
    if (uniquePayment.includes(handIndex))
      return { error: 'La carte invoquée ne peut pas payer son propre coût' };
    for (const i of uniquePayment) {
      if (i < 0 || i >= player.hand.length)
        return { error: `Index de paiement invalide: ${i}` };
    }

    const recycleUsed = Math.min(player.recycleEnergy, cost);
    player.recycleEnergy -= recycleUsed;

    const sortedPay = [...uniquePayment].sort((a, b) => b - a);
    for (let i = 0; i < handPayNeeded; i++) {
      const [discarded] = player.hand.splice(sortedPay[i], 1);
      player.graveyard.push(discarded);
    }

    return this.place(
      game,
      player,
      opponent,
      target,
      card,
      zoneIndex,
      onOpponentZone,
      userId,
    );
  }

  /** Pose `card` (encore en main) dans la zone : événement, journal, ON_SUMMON, ON_ALLY_SUMMON. */
  private place(
    game: GameState,
    player: PlayerGameState,
    opponent: PlayerGameState,
    target: PlayerGameState,
    card: CardInstance,
    zoneIndex: number,
    onOpponentZone: boolean,
    userId: number,
  ): { error?: string } {
    const [monster] = player.hand.splice(player.hand.indexOf(card), 1);

    const instance = createMonsterOnBoard(monster, {
      // Mémorise le poseur quand c'est une zone adverse (Zeta)
      ownerUserId: onOpponentZone ? userId : undefined,
    });

    target.monsterZones[zoneIndex] = instance;
    game.pendingEvents.push({
      kind: 'monster_summoned',
      ownerId: target.userId,
      zoneIndex,
      instanceId: instance.instanceId,
      rarity: monster.baseCard.rarity,
    });

    addLog(
      game,
      onOpponentZone
        ? `🦠 ${player.username} implante ${monster.baseCard.name} sur le terrain de ${opponent.username} !`
        : `${player.username} invoque ${monster.baseCard.name} (${monster.baseCard.atk}ATK / ${monster.baseCard.hp}HP)`,
    );

    const summonLog: string[] = [];
    this.effectsResolver.resolve(monster, EffectTrigger.ON_SUMMON, {
      game,
      ownerUserId: userId,
      sourceMonster: instance,
      log: summonLog,
    });
    summonLog.forEach((l) => addLog(game, l));

    for (const handCard of player.hand) {
      const allyLog: string[] = [];
      this.effectsResolver.resolve(handCard, EffectTrigger.ON_ALLY_SUMMON, {
        game,
        ownerUserId: userId,
        log: allyLog,
      });
      allyLog.forEach((l) => addLog(game, l));
    }
    return {};
  }

  /**
   * Drakon des Origines : le monstre `sourceInstanceId` garde ses effets et
   * reçoit ceux de `picked` (qui reste au cimetière). L'arrivée copiée se
   * résout aussitôt ; la carte d'origine est mémorisée pour sa sortie du terrain.
   */
  copyEffects(
    game: GameState,
    player: PlayerGameState,
    sourceInstanceId: string | undefined,
    picked: CardInstance,
  ): void {
    const monster = player.monsterZones.find(
      (m) => m?.instanceId === sourceInstanceId,
    );
    if (!monster) {
      addLog(
        game,
        `💨 Le monstre qui devait copier ${picked.baseCard.name} a disparu`,
      );
      return;
    }
    monster.originalCard ??= monster.card;
    const own = monster.originalCard;
    monster.card = {
      ...own,
      baseCard: {
        ...own.baseCard,
        effects: [
          ...(own.baseCard.effects ?? []),
          ...(picked.baseCard.effects ?? []),
        ],
      },
    };
    addLog(
      game,
      `🐉 ${own.baseCard.name} prend le pouvoir de ${picked.baseCard.name}`,
    );
    const log: string[] = [];
    this.effectsResolver.resolve(
      { ...monster.card, baseCard: { ...picked.baseCard } },
      EffectTrigger.ON_SUMMON,
      { game, ownerUserId: player.userId, sourceMonster: monster, log },
    );
    log.forEach((l) => addLog(game, l));
  }

  /** Raison du refus d'une Relève, ou null. */
  private releveError(
    player: PlayerGameState,
    card: CardInstance,
    sacrificed: string[],
  ): string | null {
    const needed = releveCount(card.baseCard.effects);
    if (needed === 0) return `${card.baseCard.name} n'a pas la Relève`;
    const unique = new Set(sacrificed);
    if (unique.size !== needed || sacrificed.length !== needed)
      return `La Relève de ${card.baseCard.name} demande ${needed} allié(s)`;
    for (const id of unique) {
      const ally = player.monsterZones.find((m) => m?.instanceId === id);
      if (
        !ally ||
        isImplanted(ally, player.userId) ||
        ally.card.baseCard.archetype !== Archetype.PIPOU
      )
        return 'La Relève ne sacrifie que des alliés Pipou de ton terrain';
    }
    return null;
  }
}
