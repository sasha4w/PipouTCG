import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DataSource,
  IsNull,
  MoreThanOrEqual,
  type EntityManager,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  ADVENTURE_BOSS_LEVEL,
  ADVENTURE_DAILY_CAP_DEFAULT,
  Rarity,
  type AdventureArchetype,
  type AdventureLoot,
  type AdventureOpponentView,
  type AdventureOverview,
  type AdventureResultPayload,
  type AdventureWorldView,
} from '@pipou/shared';
import { Card } from '../cards/card.entity';
import { checkDeckForMatch } from '../decks/deck-rules';
import type { AiLevel } from '../fights/ai/ai-player';
import type { GameState } from '../fights/interfaces/game-state.interface';
import type { PveHooks, PveInfo, PveStart } from '../fights/pve';
import { UsersService } from '../users/users.service';
import {
  farmWindowStart,
  canActivateWorld,
  countsAsPlayed,
  isWorldUnlocked,
  opponentStates,
  rollLoot,
} from './adventure-rules';
import { AdventureMatch } from './entities/adventure-match.entity';
import { AdventureOpponent } from './entities/adventure-opponent.entity';
import { AdventureSettings } from './entities/adventure-settings.entity';
import { AdventureWorld } from './entities/adventure-world.entity';
import type { Signature } from './signatures';

const ARCHETYPES: readonly AdventureArchetype[] = [
  'pipou',
  'pixelman',
  'dragon',
];

/** Victoires d'un joueur, par IA (combats terminés et gagnés uniquement). */
interface Progress {
  wins: Map<number, number>;
  /** worldId → positions battues. */
  beaten: Map<number, Set<number>>;
  /** Mondes dont le boss est battu. */
  completed: Set<number>;
}

export interface AdventureFinishedEvent {
  userId: number;
  won: boolean;
}

/**
 * Progression du mode Aventure : vue joueur, contrôle du lancement d'un
 * combat et enregistrement du résultat (récompenses en une transaction).
 * `adventure_match` est la source de vérité ; seuls les combats terminés
 * (`won` non nul) comptent, les lignes orphelines sont ignorées.
 */
@Injectable()
export class AdventureService implements PveHooks {
  private readonly logger = new Logger(AdventureService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly users: UsersService,
    private readonly events: EventEmitter2,
  ) {}

  // ── Vue joueur ─────────────────────────────────────────────────────────────

  async getOverview(
    userId: number,
    now = new Date(),
  ): Promise<AdventureOverview> {
    const m = this.dataSource.manager;
    const [worlds, progress, farmRewardsToday, dailyCap] = await Promise.all([
      m.find(AdventureWorld, {
        where: { isActive: true },
        relations: {
          cardSet: true,
          booster: true,
          prerequisites: true,
          opponents: { portraitCard: true },
        },
      }),
      this.progress(userId, m),
      this.countFarmRewardsToday(userId, now, m),
      this.dailyCap(m),
    ]);
    return {
      worlds: [...worlds]
        .sort((a, b) => a.order - b.order || a.id - b.id)
        .map((w) => this.worldView(w, progress)),
      farmRewardsToday,
      dailyCap,
    };
  }

  /** Victoires de farm récompensées depuis le dernier reset quotidien. */
  countFarmRewardsToday(
    userId: number,
    now = new Date(),
    manager: EntityManager = this.dataSource.manager,
  ): Promise<number> {
    return manager.count(AdventureMatch, {
      where: {
        userId,
        won: true,
        firstWin: false,
        rewarded: true,
        endedAt: MoreThanOrEqual(farmWindowStart(now)),
      },
    });
  }

  // ── Lancement ──────────────────────────────────────────────────────────────

  async prepareStart(userId: number, opponentId: number): Promise<PveStart> {
    const m = this.dataSource.manager;
    const opponent = await m.findOne(AdventureOpponent, {
      where: { id: opponentId },
      relations: { world: { prerequisites: true }, cards: { card: true } },
    });
    if (!opponent) throw new BadRequestException('IA introuvable');
    if (!opponent.world.isActive)
      throw new BadRequestException("Ce monde n'est pas disponible");
    // Booster supprimé (FK SET NULL) ou set sans légendaire depuis
    // l'activation : la 1re victoire ne pourrait pas être payée en entier.
    const legendaryCount = await m.count(Card, {
      where: {
        cardSet: { id: opponent.world.cardSetId },
        rarity: Rarity.LEGENDARY,
      },
    });
    if (
      !canActivateWorld({ boosterId: opponent.world.boosterId, legendaryCount })
        .ok
    )
      throw new BadRequestException(
        "Ce monde n'est pas disponible pour le moment",
      );

    const progress = await this.progress(userId, m);
    const prerequisiteIds = opponent.world.prerequisites.map((p) => p.id);
    if (!isWorldUnlocked({ prerequisiteIds }, progress.completed))
      throw new BadRequestException(
        "Monde verrouillé : termine d'abord les mondes requis",
      );
    const states = opponentStates(
      progress.beaten.get(opponent.worldId) ?? new Set(),
    );
    if ((states[opponent.position - 1] ?? 'locked') === 'locked')
      throw new BadRequestException(
        "IA verrouillée : bats d'abord l'IA précédente",
      );

    const problem = checkDeckForMatch(
      opponent.cards.map((c) => ({
        cardId: c.cardId,
        cardName: c.card.name,
        quantity: c.quantity,
        owned: c.quantity,
      })),
    );
    if (problem)
      throw new BadRequestException(`Deck de l'IA invalide : ${problem}`);

    const archetype = this.archetypeOf(opponent);
    const match = await m.save(
      AdventureMatch,
      m.create(AdventureMatch, { userId, opponentId, won: null }),
    );
    return {
      adventureMatchId: match.id,
      opponentId,
      opponentName: opponent.name,
      profile: { archetype, level: opponent.position as AiLevel },
      aiCards: opponent.cards.flatMap((c) =>
        Array.from({ length: c.quantity }, () => ({
          instanceId: uuidv4(),
          baseCard: c.card,
          ownerId: 0,
        })),
      ),
    };
  }

  // ── Résultat ───────────────────────────────────────────────────────────────

  async recordResult(
    game: GameState,
    pve: PveInfo,
    now = new Date(),
  ): Promise<AdventureResultPayload> {
    // Invariants : un seul combat PvE à la fois par joueur (garanti par
    // FightsService), d'où l'absence de verrou sur firstWin et le plafond
    // de farm. Le monde n'est pas revérifié ici : un monde désactivé (ou
    // privé de booster/légendaire) en cours de partie paie quand même le
    // combat en cours, avec ce qui reste disponible.
    let setCheck: number | null = null;
    const { userId, payload } = await this.dataSource.transaction(async (m) => {
      const match = await m.findOne(AdventureMatch, {
        where: { id: pve.adventureMatchId },
      });
      if (!match)
        throw new Error(
          `Combat d'aventure ${pve.adventureMatchId} introuvable`,
        );
      const opponent = await m.findOne(AdventureOpponent, {
        where: { id: match.opponentId },
        relations: { world: { booster: true } },
      });
      if (!opponent) throw new Error(`IA ${match.opponentId} introuvable`);
      const world = opponent.world;
      const before = await this.progress(match.userId, m);
      const won = game.winner === match.userId;

      // Garde contre un double enregistrement (et donc un double paiement)
      const closed = await m.update(
        AdventureMatch,
        { id: match.id, won: IsNull() },
        {
          won,
          endReason: game.endReason ?? null,
          turns: game.turnNumber,
          endedAt: now,
        },
      );
      if (closed.affected !== 1)
        throw new Error(`Combat d'aventure ${match.id} déjà enregistré`);

      const result: AdventureResultPayload = {
        opponentId: opponent.id,
        worldId: opponent.worldId,
        won,
        firstWin: false,
        loot: null,
        worldCompleted: false,
        unlockedWorldIds: [],
      };
      if (!won) return { userId: match.userId, payload: result };

      const isBoss = opponent.position === ADVENTURE_BOSS_LEVEL;
      const firstWin = !before.wins.has(opponent.id);
      const roll = rollLoot({
        firstWin,
        isBoss,
        config: opponent,
        farmRewardsToday: firstWin
          ? 0
          : await this.countFarmRewardsToday(match.userId, now, m),
        dailyCap: await this.dailyCap(m),
        random: Math.random,
      });

      const loot: AdventureLoot = {
        gold: roll.gold,
        xp: roll.xp,
        boosters: [],
        cards: [],
        capped: roll.capped,
      };
      if (roll.gold > 0) await this.users.addGold(match.userId, roll.gold, m);
      if (roll.xp > 0) await this.users.addExperience(match.userId, roll.xp, m);
      if (roll.booster) {
        if (world.boosterId === null || !world.booster)
          this.logger.warn(`Monde ${world.id} sans booster de récompense`);
        else {
          await this.users.addBoosterToUser(
            match.userId,
            world.boosterId,
            1,
            m,
          );
          loot.boosters.push({
            boosterId: world.boosterId,
            name: world.booster.name,
            quantity: 1,
          });
        }
      }
      if (roll.legendary) {
        const pool = await m.find(Card, {
          where: { cardSet: { id: world.cardSetId }, rarity: Rarity.LEGENDARY },
        });
        const card = pool[Math.floor(Math.random() * pool.length)];
        if (!card)
          this.logger.warn(`Set ${world.cardSetId} sans carte légendaire`);
        else {
          await this.users.addCardToUser(match.userId, card.id, 1, m);
          loot.cards.push({
            cardId: card.id,
            name: card.name,
            rarity: card.rarity,
            imageUrl: card.image?.url ?? null,
          });
          setCheck = world.cardSetId;
        }
      }
      const gained =
        loot.gold > 0 ||
        loot.xp > 0 ||
        loot.boosters.length > 0 ||
        loot.cards.length > 0;
      await m.update(
        AdventureMatch,
        { id: match.id },
        { firstWin, rewarded: !loot.capped && gained, loot },
      );

      result.firstWin = firstWin;
      result.loot = loot;
      if (firstWin && isBoss) {
        result.worldCompleted = true;
        result.unlockedWorldIds = await this.newlyUnlocked(
          before.completed,
          world.id,
          m,
        );
      }
      return { userId: match.userId, payload: result };
    });

    // Un abandon immédiat ne compte pas comme combat joué (quêtes).
    if (countsAsPlayed(payload.won, game.turnNumber)) {
      const finished: AdventureFinishedEvent = { userId, won: payload.won };
      this.events.emit('adventure.finished', finished);
    }
    if (setCheck !== null)
      this.events.emit('card.set.check', { userId, setId: setCheck });
    return payload;
  }

  // ── Interne ────────────────────────────────────────────────────────────────

  private async progress(userId: number, m: EntityManager): Promise<Progress> {
    const rows = await m
      .createQueryBuilder(AdventureMatch, 'm')
      .innerJoin('m.opponent', 'o')
      .select('m.opponentId', 'opponentId')
      .addSelect('o.worldId', 'worldId')
      .addSelect('o.position', 'position')
      .addSelect('COUNT(*)', 'wins')
      .where('m.userId = :userId', { userId })
      .andWhere('m.won = 1')
      .groupBy('m.opponentId')
      .addGroupBy('o.worldId')
      .addGroupBy('o.position')
      .getRawMany<{
        opponentId: number | string;
        worldId: number | string;
        position: number | string;
        wins: number | string;
      }>();

    const progress: Progress = {
      wins: new Map(),
      beaten: new Map(),
      completed: new Set(),
    };
    for (const r of rows) {
      const worldId = Number(r.worldId);
      const position = Number(r.position);
      progress.wins.set(Number(r.opponentId), Number(r.wins));
      const set = progress.beaten.get(worldId) ?? new Set<number>();
      set.add(position);
      progress.beaten.set(worldId, set);
      if (position === ADVENTURE_BOSS_LEVEL) progress.completed.add(worldId);
    }
    return progress;
  }

  private async dailyCap(m: EntityManager): Promise<number> {
    const settings = await m.findOne(AdventureSettings, { where: { id: 1 } });
    return settings?.dailyCap ?? ADVENTURE_DAILY_CAP_DEFAULT;
  }

  /** Mondes actifs que la complétion de `worldId` vient de débloquer. */
  private async newlyUnlocked(
    completedBefore: Set<number>,
    worldId: number,
    m: EntityManager,
  ): Promise<number[]> {
    const after = new Set(completedBefore).add(worldId);
    const worlds = await m.find(AdventureWorld, {
      where: { isActive: true },
      relations: { prerequisites: true },
    });
    return worlds
      .filter((w) => {
        const prerequisiteIds = w.prerequisites.map((p) => p.id);
        return (
          prerequisiteIds.length > 0 &&
          !isWorldUnlocked({ prerequisiteIds }, completedBefore) &&
          isWorldUnlocked({ prerequisiteIds }, after)
        );
      })
      .sort((a, b) => a.order - b.order || a.id - b.id)
      .map((w) => w.id);
  }

  private archetypeOf(opponent: AdventureOpponent): AdventureArchetype {
    let signature: Partial<Signature> | null = null;
    try {
      signature = JSON.parse(opponent.signature) as Partial<Signature>;
    } catch {
      // traité ci-dessous
    }
    const archetype = signature?.archetype;
    if (!archetype || !ARCHETYPES.includes(archetype))
      throw new Error(`Signature invalide pour l'IA ${opponent.id}`);
    return archetype;
  }

  private worldView(w: AdventureWorld, progress: Progress): AdventureWorldView {
    const prerequisiteIds = w.prerequisites.map((p) => p.id);
    const unlocked = isWorldUnlocked({ prerequisiteIds }, progress.completed);
    const beaten = progress.beaten.get(w.id) ?? new Set<number>();
    const states = opponentStates(beaten);
    const opponents = [...w.opponents]
      .sort((a, b) => a.position - b.position)
      .map((o): AdventureOpponentView => {
        const isBoss = o.position === ADVENTURE_BOSS_LEVEL;
        const state = states[o.position - 1] ?? 'locked';
        return {
          id: o.id,
          position: o.position,
          level: o.position,
          name: o.name,
          quote: o.quote,
          portrait: {
            cardId: o.portraitCardId ?? 0,
            imageUrl: o.portraitCard?.image?.url ?? null,
          },
          state: unlocked || state === 'beaten' ? state : 'locked',
          wins: progress.wins.get(o.id) ?? 0,
          isBoss,
          firstWin: {
            gold: o.firstWinGold,
            xp: o.firstWinXp,
            boosterName: w.booster?.name ?? null,
            legendary: isBoss,
          },
          farm: {
            gold: o.farmGold,
            xp: o.farmXp,
            boosterPct: o.farmBoosterPct,
            legendaryPct: isBoss ? o.farmLegendaryPct : 0,
          },
        };
      });
    return {
      id: w.id,
      name: w.name,
      cardSetId: w.cardSetId,
      cardSetName: w.cardSet.name,
      order: w.order,
      unlocked,
      requires: w.prerequisites.map((p) => ({ id: p.id, name: p.name })),
      beaten: beaten.size,
      completed: progress.completed.has(w.id),
      opponents,
    };
  }
}
