import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { Match, MatchStatus, MatchEndReason } from './entities/match.entity';
import { PlayerStats } from './entities/player-stats.entity';
import { DecksService } from '../decks/decks.service';
import { Card } from '../cards/card.entity';
import { CardType } from '../cards/enums/cardtype.enum';
import { SupportType } from '../cards/enums/support-type.enum';
import { EffectTrigger } from '../cards/interfaces/card-effect.interface';
import { EffectsResolverService } from './effects-resolver.service';
import { BuffsCalculatorService } from './buffs-calculator.service';
import {
  GameState,
  PlayerGameState,
  MonsterOnBoard,
  GameEndReason,
  ClientGameState,
  CombatMode,
} from './interfaces/game-state.interface';

// ─── Internal types ───────────────────────────────────────────────────────────

interface QueueEntry {
  userId: number;
  username: string;
  socketId: string;
}

interface MatchFoundInfo {
  matchId: number;
  p1: QueueEntry;
  p2: QueueEntry;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STARTING_PRIMES = 6;
const STARTING_HAND = 5;
const HAND_LIMIT = 7;
const ELO_K = 32;
const LOG_MAX = 50;

/** Milliseconds a player has to act before auto-advancing the phase. */
const TURN_TIMEOUT_MS = 90_000; // 90 s

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class FightsService {
  private games = new Map<number, GameState>();
  private queue = new Map<number, QueueEntry>();
  private userToMatch = new Map<number, number>();

  /** Active timeout handles, keyed by matchId. */
  private timeouts = new Map<number, NodeJS.Timeout>();

  constructor(
    @InjectRepository(Match) private matchRepo: Repository<Match>,
    @InjectRepository(PlayerStats) private statsRepo: Repository<PlayerStats>,
    private decksService: DecksService,
    private effectsResolver: EffectsResolverService,
    private buffsCalc: BuffsCalculatorService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // MATCHMAKING
  // ═══════════════════════════════════════════════════════════════════════════

  async joinQueue(
    userId: number,
    username: string,
    socketId: string,
    server: Server,
  ): Promise<MatchFoundInfo | null> {
    if (this.userToMatch.has(userId)) return null;
    this.queue.set(userId, { userId, username, socketId });
    if (this.queue.size < 2) return null;

    const [p1, p2] = [...this.queue.values()];
    this.queue.delete(p1.userId);
    this.queue.delete(p2.userId);

    const match = await this.matchRepo.save(
      this.matchRepo.create({
        player1Id: p1.userId,
        player2Id: p2.userId,
        status: MatchStatus.IN_PROGRESS,
      }),
    );

    const game: GameState = {
      matchId: match.id,
      player1: this.createEmptyPlayerState(p1),
      player2: this.createEmptyPlayerState(p2),
      currentTurnUserId: p1.userId,
      phase: 'waiting',
      turnNumber: 0,
      log: [],
    };
    this.games.set(match.id, game);
    this.userToMatch.set(p1.userId, match.id);
    this.userToMatch.set(p2.userId, match.id);

    return { matchId: match.id, p1, p2 };
  }

  leaveQueue(userId: number): void {
    this.queue.delete(userId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DECK SUBMISSION
  // ═══════════════════════════════════════════════════════════════════════════

  async submitDeck(
    matchId: number,
    userId: number,
    deckId: number,
    server: Server,
  ): Promise<{ error?: string }> {
    const game = this.getGame(matchId);
    if (!game) return { error: 'Match introuvable' };
    if (game.phase !== 'waiting') return { error: 'Le match a déjà commencé' };

    const player = this.getPlayerState(game, userId);
    if (player.ready) return { error: 'Deck déjà soumis' };

    let cards: Card[];
    try {
      cards = await this.decksService.loadDeckCards(deckId, userId);
    } catch {
      return { error: 'Deck invalide ou inaccessible' };
    }

    if (cards.length < 20)
      return { error: 'Le deck doit contenir au moins 20 cartes' };

    const shuffled = this.shuffle(cards);
    player.primeDeck = shuffled.splice(0, STARTING_PRIMES);
    player.primes = STARTING_PRIMES;
    player.deck = shuffled;
    for (let i = 0; i < STARTING_HAND; i++) {
      const c = player.deck.shift();
      if (c) player.hand.push(c);
    }
    player.ready = true;

    if (game.player1.ready && game.player2.ready) {
      game.phase = 'main';
      game.turnNumber = 1;
      this.addLog(
        game,
        `⚔️ Combat ! Tour 1 — ${game.player1.username} commence`,
      );
      this.startTurnTimeout(game, server);
      this.emitGameState(game, server);
    } else {
      server.to(player.socketId).emit('fight:deck_accepted', { matchId });
    }
    return {};
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE ADVANCEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  async endPhase(
    matchId: number,
    userId: number,
    server: Server,
  ): Promise<{ error?: string }> {
    const game = this.getGame(matchId);
    if (!game) return { error: 'Match introuvable' };
    if (!this.isCurrentPlayer(game, userId))
      return { error: "Ce n'est pas ton tour" };

    const player = this.getPlayerState(game, userId);
    const opponent = this.getOpponentState(game, userId);

    switch (game.phase) {
      case 'main':
        game.phase = 'battle';
        this.addLog(game, `${player.username} → phase de combat`);
        break;

      case 'battle':
        game.phase = 'end';
        break;

      case 'end': {
        const surplus = player.hand.length - HAND_LIMIT;
        if (surplus > 0) {
          return { error: `Défaussez ${surplus} carte(s) avant de terminer` };
        }
        // Reset per-turn flags
        for (const z of player.monsterZones)
          if (z) z.hasAttackedThisTurn = false;
        player.recycleEnergy = 0;
        player.hasDrawnThisTurn = false;

        // Switch to opponent
        game.currentTurnUserId = opponent.userId;
        game.turnNumber += 1;

        // ON_TURN_START for opponent's monsters
        this.triggerTurnStart(game, opponent, server);

        // Auto-draw for new player
        const drawn = this.drawCard(game, opponent.userId);
        if (!drawn) {
          await this.endGame(game, userId, 'deck_empty', server);
          return {};
        }
        game.phase = 'main';
        this.addLog(
          game,
          `─── Tour ${game.turnNumber} — ${opponent.username} ───`,
        );
        break;
      }

      default:
        return { error: `Phase invalide : ${game.phase}` };
    }

    this.resetTurnTimeout(game, server);
    this.emitGameState(game, server);
    return {};
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN PHASE — SUMMON
  // ═══════════════════════════════════════════════════════════════════════════

  async summonMonster(
    matchId: number,
    userId: number,
    handIndex: number,
    zoneIndex: number,
    paymentHandIndices: number[],
    server: Server,
  ): Promise<{ error?: string }> {
    const game = this.getGame(matchId);
    if (!game) return { error: 'Match introuvable' };
    if (!this.isCurrentPlayer(game, userId))
      return { error: "Ce n'est pas ton tour" };
    if (game.phase !== 'main') return { error: 'Phase principale uniquement' };

    const player = this.getPlayerState(game, userId);

    if (zoneIndex < 0 || zoneIndex > 2) return { error: 'Zone invalide (0-2)' };
    if (player.monsterZones[zoneIndex]) return { error: 'Zone occupée' };
    if (handIndex < 0 || handIndex >= player.hand.length)
      return { error: 'Index main invalide' };

    const card = player.hand[handIndex];
    if (card.type !== CardType.MONSTER) return { error: 'Pas un Monstre' };

    const cost = card.cost ?? 0;
    const uniquePayment = [...new Set(paymentHandIndices)];
    const handPayNeeded = Math.max(0, cost - player.recycleEnergy);

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

    // Deduct recycle energy
    const recycleUsed = Math.min(player.recycleEnergy, cost);
    player.recycleEnergy -= recycleUsed;

    // Discard payment cards (highest indices first to avoid shifting)
    const sortedPay = [...uniquePayment].sort((a, b) => b - a);
    for (let i = 0; i < handPayNeeded; i++) {
      const [discarded] = player.hand.splice(sortedPay[i], 1);
      player.graveyard.push(discarded);
    }

    // Adjust monster index after removals
    const removedBefore = sortedPay.filter(
      (i, n) => i < handIndex && n < handPayNeeded,
    ).length;
    const [monster] = player.hand.splice(handIndex - removedBefore, 1);

    const instance: MonsterOnBoard = {
      instanceId: uuidv4(),
      card: monster,
      currentHp: monster.hp,
      mode: 'attack',
      equipments: [],
      atkBuff: 0,
      hpBuff: 0,
      hasAttackedThisTurn: false,
    };
    player.monsterZones[zoneIndex] = instance;

    this.addLog(
      game,
      `${player.username} invoque ${monster.name} (${monster.atk}ATK / ${monster.hp}HP)`,
    );

    // ── Trigger ON_SUMMON ──────────────────────────────────────────────────
    const log: string[] = [];
    this.effectsResolver.resolve(monster, EffectTrigger.ON_SUMMON, {
      game,
      ownerUserId: userId,
      sourceMonster: instance,
      log,
    });
    log.forEach((l) => this.addLog(game, l));

    // Recalculate buffs for both sides (terrain may affect newly placed monster)
    this.buffsCalc.recalculate(player);
    this.buffsCalc.recalculate(this.getOpponentState(game, userId));

    this.resetTurnTimeout(game, server);
    this.emitGameState(game, server);
    return {};
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN PHASE — PLAY SUPPORT
  // ═══════════════════════════════════════════════════════════════════════════

  async playSupport(
    matchId: number,
    userId: number,
    handIndex: number,
    zoneIndex: number | undefined,
    targetInstanceId: string | undefined,
    server: Server,
  ): Promise<{ error?: string }> {
    const game = this.getGame(matchId);
    if (!game) return { error: 'Match introuvable' };
    if (!this.isCurrentPlayer(game, userId))
      return { error: "Ce n'est pas ton tour" };
    if (game.phase !== 'main') return { error: 'Phase principale uniquement' };

    const player = this.getPlayerState(game, userId);
    if (handIndex < 0 || handIndex >= player.hand.length)
      return { error: 'Index main invalide' };

    const card = player.hand[handIndex];
    if (card.type !== CardType.SUPPORT) return { error: 'Pas un Support' };

    const [support] = player.hand.splice(handIndex, 1);
    const log: string[] = [];

    switch (support.supportType) {
      case SupportType.EPHEMERAL: {
        player.graveyard.push(support);
        this.addLog(game, `${player.username} joue ${support.name}`);
        // ON_PLAY trigger
        this.effectsResolver.resolve(support, EffectTrigger.ON_PLAY, {
          game,
          ownerUserId: userId,
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
        this.addLog(
          game,
          `${player.username} équipe ${support.name} sur ${target.card.name}`,
        );
        this.effectsResolver.resolve(support, EffectTrigger.ON_PLAY, {
          game,
          ownerUserId: userId,
          sourceMonster: target,
          log,
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
        this.addLog(
          game,
          `${player.username} pose ${support.name} en zone ${zoneIndex}`,
        );
        this.effectsResolver.resolve(support, EffectTrigger.ON_PLAY, {
          game,
          ownerUserId: userId,
          log,
        });
        this.buffsCalc.recalculate(player);
        break;
      }

      default:
        player.hand.splice(handIndex, 0, support);
        return { error: 'Type de support inconnu' };
    }

    log.forEach((l) => this.addLog(game, l));
    this.checkWinAndEmit(game, server);
    return {};
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN PHASE — RECYCLE / CHANGE MODE
  // ═══════════════════════════════════════════════════════════════════════════

  async recycleSupport(
    matchId: number,
    userId: number,
    zoneIndex: number,
    server: Server,
  ): Promise<{ error?: string }> {
    const game = this.getGame(matchId);
    if (!game) return { error: 'Match introuvable' };
    if (!this.isCurrentPlayer(game, userId))
      return { error: "Ce n'est pas ton tour" };
    if (game.phase !== 'main') return { error: 'Phase principale uniquement' };

    const player = this.getPlayerState(game, userId);
    if (zoneIndex < 0 || zoneIndex > 2 || !player.supportZones[zoneIndex]) {
      return { error: 'Aucun support en zone ' + zoneIndex };
    }

    const support = player.supportZones[zoneIndex]!;
    player.supportZones[zoneIndex] = null;
    player.graveyard.push(support);
    player.recycleEnergy += 1;

    // Buffs need recalc since terrain is gone
    this.buffsCalc.recalculate(player);

    this.addLog(
      game,
      `${player.username} recycle ${support.name} → +1 énergie`,
    );
    this.resetTurnTimeout(game, server);
    this.emitGameState(game, server);
    return {};
  }

  async changeMode(
    matchId: number,
    userId: number,
    instanceId: string,
    mode: CombatMode,
    server: Server,
  ): Promise<{ error?: string }> {
    const game = this.getGame(matchId);
    if (!game) return { error: 'Match introuvable' };
    if (!this.isCurrentPlayer(game, userId))
      return { error: "Ce n'est pas ton tour" };
    if (game.phase !== 'main')
      return { error: 'Changement de mode en phase principale uniquement' };

    const player = this.getPlayerState(game, userId);
    const monster = player.monsterZones.find(
      (m) => m?.instanceId === instanceId,
    );
    if (!monster) return { error: 'Monstre introuvable' };

    monster.mode = mode;
    this.addLog(
      game,
      `${player.username} : ${monster.card.name} → mode ${mode === 'attack' ? 'Attaque ⚔️' : 'Garde 🛡️'}`,
    );
    this.resetTurnTimeout(game, server);
    this.emitGameState(game, server);
    return {};
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BATTLE PHASE — ATTACK
  // ═══════════════════════════════════════════════════════════════════════════

  async attack(
    matchId: number,
    userId: number,
    attackerInstanceId: string,
    targetInstanceId: string | undefined,
    direct: boolean,
    server: Server,
  ): Promise<{ error?: string }> {
    const game = this.getGame(matchId);
    if (!game) return { error: 'Match introuvable' };
    if (!this.isCurrentPlayer(game, userId))
      return { error: "Ce n'est pas ton tour" };
    if (game.phase !== 'battle') return { error: 'Phase de combat uniquement' };

    const player = this.getPlayerState(game, userId);
    const opponent = this.getOpponentState(game, userId);

    const attacker = player.monsterZones.find(
      (m) => m?.instanceId === attackerInstanceId,
    );
    if (!attacker) return { error: 'Attaquant introuvable' };
    if (attacker.mode !== 'attack') return { error: 'Monstre en mode Garde' };
    if (attacker.hasAttackedThisTurn) return { error: 'Déjà attaqué ce tour' };

    attacker.hasAttackedThisTurn = true;

    const attackerAtk = attacker.card.atk + attacker.atkBuff;

    // ── Trigger ON_ATTACK ────────────────────────────────────────────────────
    const onAttackLog: string[] = [];
    this.effectsResolver.resolve(attacker.card, EffectTrigger.ON_ATTACK, {
      game,
      ownerUserId: userId,
      sourceMonster: attacker,
      log: onAttackLog,
    });
    onAttackLog.forEach((l) => this.addLog(game, l));

    // ── Direct attack ────────────────────────────────────────────────────────
    if (direct) {
      if (opponent.monsterZones.some((z) => z !== null)) {
        return {
          error: "Attaque directe impossible : l'adversaire a des monstres",
        };
      }
      if (opponent.primes > 0 && opponent.primeDeck.length > 0) {
        const prime = opponent.primeDeck.shift()!;
        opponent.banished.push(prime);
        opponent.primes -= 1;
        this.addLog(
          game,
          `💥 Attaque directe ! ${attacker.card.name} bannit 1 Prime (${opponent.primes} restantes)`,
        );
      }
      await this.checkWinAndEmit(game, server);
      return {};
    }

    // ── Monster vs Monster ───────────────────────────────────────────────────
    if (!targetInstanceId) return { error: 'Cible requise' };
    const target = opponent.monsterZones.find(
      (m) => m?.instanceId === targetInstanceId,
    );
    if (!target) return { error: 'Cible introuvable' };

    const targetAtk = target.card.atk + target.atkBuff;

    // Trigger ON_DEFEND for target
    const onDefendLog: string[] = [];
    this.effectsResolver.resolve(target.card, EffectTrigger.ON_DEFEND, {
      game,
      ownerUserId: opponent.userId,
      sourceMonster: target,
      targetMonster: attacker,
      log: onDefendLog,
    });
    onDefendLog.forEach((l) => this.addLog(game, l));

    if (target.mode === 'attack') {
      // Mutual damage
      attacker.currentHp -= targetAtk;
      target.currentHp -= attackerAtk;

      const aDied = attacker.currentHp <= 0;
      const tDied = target.currentHp <= 0;

      if (aDied && tDied) {
        this.addLog(
          game,
          `⚔️ Double KO ! ${attacker.card.name} & ${target.card.name}`,
        );
        this.removeMonster(player, attackerInstanceId, game);
        this.removeMonster(opponent, targetInstanceId, game);
        this.stealPrime(game, opponent.userId, userId);
        this.stealPrime(game, userId, opponent.userId);
        this.drawCard(game, userId);
        this.drawCard(game, opponent.userId);
      } else if (tDied) {
        this.addLog(
          game,
          `⚔️ ${attacker.card.name} détruit ${target.card.name}`,
        );
        this.removeMonster(opponent, targetInstanceId, game);
        this.stealPrime(game, userId, opponent.userId);
        this.drawCard(game, opponent.userId);
      } else if (aDied) {
        this.addLog(
          game,
          `⚔️ ${target.card.name} détruit ${attacker.card.name}`,
        );
        this.removeMonster(player, attackerInstanceId, game);
        this.stealPrime(game, opponent.userId, userId);
        this.drawCard(game, userId);
      } else {
        this.addLog(
          game,
          `⚔️ Duel : ${attacker.card.name} (${attacker.currentHp}HP) vs ${target.card.name} (${target.currentHp}HP)`,
        );
      }
    } else {
      // Guard — no riposte
      target.currentHp -= attackerAtk;
      if (target.currentHp <= 0) {
        this.addLog(
          game,
          `🛡️ ${attacker.card.name} brise la Garde de ${target.card.name}`,
        );
        this.removeMonster(opponent, targetInstanceId, game);
        this.drawCard(game, opponent.userId);
      } else {
        this.addLog(
          game,
          `🛡️ ${attacker.card.name} attaque ${target.card.name} (${target.currentHp}HP) — Garde tient`,
        );
      }
    }

    // Recalculate buffs after board changes
    this.buffsCalc.recalculate(player);
    this.buffsCalc.recalculate(opponent);

    this.resetTurnTimeout(game, server);
    await this.checkWinAndEmit(game, server);
    return {};
  }

  async discard(
    matchId: number,
    userId: number,
    handIndex: number,
    server: Server,
  ): Promise<{ error?: string }> {
    const game = this.getGame(matchId);
    if (!game) return { error: 'Match introuvable' };
    if (!this.isCurrentPlayer(game, userId))
      return { error: "Ce n'est pas ton tour" };
    if (game.phase !== 'end')
      return { error: 'Défausse en phase de fin uniquement' };

    const player = this.getPlayerState(game, userId);
    if (handIndex < 0 || handIndex >= player.hand.length)
      return { error: 'Index main invalide' };

    const [card] = player.hand.splice(handIndex, 1);
    player.graveyard.push(card);
    this.addLog(game, `${player.username} défausse ${card.name}`);
    this.emitGameState(game, server);
    return {};
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SURRENDER / DISCONNECT
  // ═══════════════════════════════════════════════════════════════════════════

  async surrender(
    matchId: number,
    userId: number,
    server: Server,
  ): Promise<void> {
    const game = this.getGame(matchId);
    if (!game) return;
    const opp = this.getOpponentState(game, userId);
    this.addLog(
      game,
      `🏳️ ${this.getPlayerState(game, userId).username} abandonne`,
    );
    await this.endGame(game, opp.userId, 'surrender', server);
  }

  async handleDisconnect(userId: number, server: Server): Promise<void> {
    this.leaveQueue(userId);
    const matchId = this.userToMatch.get(userId);
    if (!matchId) return;
    const game = this.getGame(matchId);
    if (!game || game.phase === 'finished') return;
    const opp = this.getOpponentState(game, userId);
    this.addLog(
      game,
      `🔌 ${this.getPlayerState(game, userId).username} déconnecté`,
    );
    await this.endGame(game, opp.userId, 'disconnect', server);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REST — HISTORY / STATS / LADDER
  // ═══════════════════════════════════════════════════════════════════════════

  async getMatchHistory(userId: number, page = 1, limit = 20) {
    const [data, total] = await this.matchRepo
      .createQueryBuilder('match')
      .leftJoinAndSelect('match.player1', 'player1')
      .leftJoinAndSelect('match.player2', 'player2')
      .leftJoinAndSelect('match.winner', 'winner')
      .where('match.player1Id = :u OR match.player2Id = :u', { u: userId })
      .andWhere('match.status != :s', { s: MatchStatus.IN_PROGRESS })
      .orderBy('match.startedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getLeaderboard(limit = 50): Promise<PlayerStats[]> {
    return this.statsRepo.find({
      order: { elo: 'DESC' },
      take: limit,
      relations: ['user'],
    });
  }

  async getMyStats(userId: number): Promise<PlayerStats> {
    let stats = await this.statsRepo.findOne({
      where: { userId },
      relations: ['user'],
    });
    if (!stats) {
      stats = this.statsRepo.create({ userId });
      await this.statsRepo.save(stats);
    }
    return stats;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE — TURN TIMEOUT
  // ═══════════════════════════════════════════════════════════════════════════

  private startTurnTimeout(game: GameState, server: Server): void {
    const handle = setTimeout(async () => {
      if (!this.games.has(game.matchId)) return;
      const currentGame = this.games.get(game.matchId)!;
      // Auto-end the current phase
      this.addLog(currentGame, `⏱️ Timeout — passage de phase automatique`);
      if (currentGame.phase === 'end') {
        // Force-discard surplus
        const player = this.getPlayerState(
          currentGame,
          currentGame.currentTurnUserId,
        );
        while (player.hand.length > HAND_LIMIT) {
          player.graveyard.push(player.hand.pop()!);
        }
      }
      await this.endPhase(
        currentGame.matchId,
        currentGame.currentTurnUserId,
        server,
      );
    }, TURN_TIMEOUT_MS);

    this.timeouts.set(game.matchId, handle);
  }

  private resetTurnTimeout(game: GameState, server: Server): void {
    const existing = this.timeouts.get(game.matchId);
    if (existing) clearTimeout(existing);
    this.startTurnTimeout(game, server);
  }

  private clearTurnTimeout(matchId: number): void {
    const existing = this.timeouts.get(matchId);
    if (existing) clearTimeout(existing);
    this.timeouts.delete(matchId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE — TURN START EFFECTS
  // ═══════════════════════════════════════════════════════════════════════════

  private triggerTurnStart(
    game: GameState,
    player: PlayerGameState,
    server: Server,
  ): void {
    const log: string[] = [];
    for (const zone of player.monsterZones) {
      if (!zone) continue;
      this.effectsResolver.resolve(zone.card, EffectTrigger.ON_TURN_START, {
        game,
        ownerUserId: player.userId,
        sourceMonster: zone,
        log,
      });
    }
    // Also check active terrains
    for (const terrain of player.supportZones) {
      if (!terrain) continue;
      this.effectsResolver.resolve(terrain, EffectTrigger.ON_TURN_START, {
        game,
        ownerUserId: player.userId,
        log,
      });
    }
    log.forEach((l) => this.addLog(game, l));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE — GAME HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private getGame(matchId: number) {
    return this.games.get(matchId);
  }
  private getPlayerState(game: GameState, userId: number): PlayerGameState {
    return game.player1.userId === userId ? game.player1 : game.player2;
  }
  private getOpponentState(game: GameState, userId: number): PlayerGameState {
    return game.player1.userId === userId ? game.player2 : game.player1;
  }
  private isCurrentPlayer(game: GameState, userId: number): boolean {
    return game.currentTurnUserId === userId;
  }

  private createEmptyPlayerState(entry: QueueEntry): PlayerGameState {
    return {
      userId: entry.userId,
      username: entry.username,
      socketId: entry.socketId,
      primes: 0,
      primeDeck: [],
      hand: [],
      deck: [],
      graveyard: [],
      banished: [],
      monsterZones: [null, null, null],
      supportZones: [null, null, null],
      recycleEnergy: 0,
      hasDrawnThisTurn: false,
      handLimitEnforced: false,
      ready: false,
    };
  }

  private drawCard(game: GameState, userId: number): Card | null {
    const player = this.getPlayerState(game, userId);
    const card = player.deck.shift() ?? null;
    if (card) player.hand.push(card);
    return card;
  }

  private removeMonster(
    player: PlayerGameState,
    instanceId: string,
    game: GameState,
  ): void {
    const idx = player.monsterZones.findIndex(
      (m) => m?.instanceId === instanceId,
    );
    if (idx === -1) return;
    const monster = player.monsterZones[idx]!;

    // ON_DEATH trigger
    const log: string[] = [];
    this.effectsResolver.resolve(monster.card, EffectTrigger.ON_DEATH, {
      game,
      ownerUserId: player.userId,
      sourceMonster: monster,
      log,
    });
    log.forEach((l) => this.addLog(game, l));

    player.graveyard.push(...monster.equipments, monster.card);
    player.monsterZones[idx] = null;
  }

  private stealPrime(
    game: GameState,
    fromUserId: number,
    toUserId: number,
  ): void {
    const victim = this.getPlayerState(game, fromUserId);
    const thief = this.getPlayerState(game, toUserId);
    if (victim.primes <= 0 || !victim.primeDeck.length) return;
    const prime = victim.primeDeck.shift()!;
    victim.primes -= 1;
    thief.hand.push(prime);
    this.addLog(
      game,
      `🏆 ${thief.username} vole une Prime (${prime.name}) — ${victim.primes} restantes`,
    );
  }

  private checkWinCondition(game: GameState): number | null {
    if (game.player1.primes <= 0) return game.player2.userId;
    if (game.player2.primes <= 0) return game.player1.userId;
    return null;
  }

  private async checkWinAndEmit(
    game: GameState,
    server: Server,
  ): Promise<void> {
    const winner = this.checkWinCondition(game);
    if (winner !== null) {
      await this.endGame(game, winner, 'primes_depleted', server);
    } else {
      this.emitGameState(game, server);
    }
  }

  private async endGame(
    game: GameState,
    winnerId: number,
    reason: GameEndReason,
    server: Server,
  ): Promise<void> {
    this.clearTurnTimeout(game.matchId);
    game.phase = 'finished';
    game.winner = winnerId;
    game.endReason = reason;

    const reasonMap: Record<GameEndReason, MatchEndReason> = {
      primes_depleted: MatchEndReason.PRIMES_DEPLETED,
      deck_empty: MatchEndReason.DECK_EMPTY,
      surrender: MatchEndReason.SURRENDER,
      disconnect: MatchEndReason.DISCONNECT,
    };
    const loserId =
      game.player1.userId === winnerId
        ? game.player2.userId
        : game.player1.userId;
    const winner = this.getPlayerState(game, winnerId);

    this.addLog(game, `🎉 ${winner.username} remporte la victoire !`);

    await this.matchRepo.update(game.matchId, {
      status: MatchStatus.FINISHED,
      winnerId,
      endReason: reasonMap[reason],
      totalTurns: game.turnNumber,
      endedAt: new Date(),
    });
    await this.updateStats(winnerId, loserId);

    this.emitGameState(game, server);
    server
      .to(game.player1.socketId)
      .emit('fight:game_over', { winner: winnerId, endReason: reason });
    server
      .to(game.player2.socketId)
      .emit('fight:game_over', { winner: winnerId, endReason: reason });

    this.games.delete(game.matchId);
    this.userToMatch.delete(game.player1.userId);
    this.userToMatch.delete(game.player2.userId);
  }

  private async updateStats(winnerId: number, loserId: number): Promise<void> {
    const [w, l] = await Promise.all([
      this.getOrCreateStats(winnerId),
      this.getOrCreateStats(loserId),
    ]);
    w.wins += 1;
    l.losses += 1;
    const { newWinnerElo, newLoserElo } = this.calcElo(w.elo, l.elo);
    w.elo = newWinnerElo;
    l.elo = newLoserElo;
    await this.statsRepo.save([w, l]);
  }

  private async getOrCreateStats(userId: number): Promise<PlayerStats> {
    let s = await this.statsRepo.findOne({ where: { userId } });
    if (!s) {
      s = this.statsRepo.create({ userId });
      await this.statsRepo.save(s);
    }
    return s;
  }

  private calcElo(winnerElo: number, loserElo: number) {
    const exp = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
    return {
      newWinnerElo: Math.round(winnerElo + ELO_K * (1 - exp)),
      newLoserElo: Math.max(
        100,
        Math.round(loserElo + ELO_K * (0 - (1 - exp))),
      ),
    };
  }

  private addLog(game: GameState, msg: string): void {
    game.log.push(msg);
    if (game.log.length > LOG_MAX) game.log.shift();
  }

  private emitGameState(game: GameState, server: Server): void {
    server
      .to(game.player1.socketId)
      .emit('fight:state', this.buildClientState(game, game.player1.userId));
    server
      .to(game.player2.socketId)
      .emit('fight:state', this.buildClientState(game, game.player2.userId));
  }

  private buildClientState(game: GameState, userId: number): ClientGameState {
    const me = this.getPlayerState(game, userId);
    const opp = this.getOpponentState(game, userId);
    return {
      matchId: game.matchId,
      phase: game.phase,
      turnNumber: game.turnNumber,
      isMyTurn: game.currentTurnUserId === userId,
      me: {
        userId: me.userId,
        username: me.username,
        primes: me.primes,
        hand: me.hand,
        deckCount: me.deck.length,
        graveyard: me.graveyard,
        banished: me.banished,
        monsterZones: me.monsterZones,
        supportZones: me.supportZones,
        recycleEnergy: me.recycleEnergy,
      },
      opponent: {
        userId: opp.userId,
        username: opp.username,
        primes: opp.primes,
        handCount: opp.hand.length,
        deckCount: opp.deck.length,
        graveyard: opp.graveyard,
        banished: opp.banished,
        monsterZones: opp.monsterZones,
        supportZones: opp.supportZones,
      },
      log: game.log.slice(-20),
      winner: game.winner,
      endReason: game.endReason,
    };
  }

  private shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
