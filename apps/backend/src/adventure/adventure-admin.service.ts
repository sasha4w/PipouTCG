import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ADVENTURE_DAILY_CAP_DEFAULT,
  Rarity,
  type AdminAdventureOpponent,
  type AdminAdventureOverview,
  type AdminAdventureWorld,
  type AdminAdventureDeckBody,
  type AdminAdventureOpponentBody,
  type AdminAdventureSettingsBody,
  type AdminAdventureWorldBody,
  type AdventureArchetype,
} from '@pipou/shared';
import { DataSource, type EntityManager } from 'typeorm';
import { Booster } from '../boosters/booster.entity';
import { CardSet } from '../card-sets/card-set.entity';
import { Card } from '../cards/card.entity';
import { checkDeckForMatch } from '../decks/deck-rules';
import { canActivateWorld } from './adventure-rules';
import { defaultSignatures } from './default-signatures';
import { generateDeck } from './deck-generator';
import { AdventureOpponentCard } from './entities/adventure-opponent-card.entity';
import { AdventureOpponent } from './entities/adventure-opponent.entity';
import { AdventureSettings } from './entities/adventure-settings.entity';
import { AdventureWorld } from './entities/adventure-world.entity';
import type { Signature } from './signatures';
import { persistWorld, planOpponents } from './world-factory';

const ARCHETYPES: readonly AdventureArchetype[] = [
  'pipou',
  'pixelman',
  'dragon',
];
const WORLD_RELATIONS = {
  cardSet: true,
  prerequisites: true,
  opponents: { cards: { card: true } },
} as const;

/**
 * Édition du mode Aventure par l'admin : mondes, IA (identité, récompenses,
 * deck) et plafond de farm. Chaque mutation renvoie la vue admin du monde
 * touché ; le contrôle d'activation et des prérequis y est centralisé.
 */
@Injectable()
export class AdventureAdminService {
  /** Source de hasard des decks ; remplaçable en test. */
  random: () => number = Math.random;

  constructor(private readonly dataSource: DataSource) {}

  // ── Lecture ────────────────────────────────────────────────────────────────

  async getOverview(): Promise<AdminAdventureOverview> {
    const m = this.dataSource.manager;
    const worlds = await m.find(AdventureWorld, { relations: WORLD_RELATIONS });
    worlds.sort((a, b) => a.order - b.order || a.id - b.id);
    return {
      worlds: await Promise.all(worlds.map((w) => this.toView(m, w))),
      dailyCap: await this.dailyCap(m),
    };
  }

  // ── Mondes ─────────────────────────────────────────────────────────────────

  async createWorld(
    body: AdminAdventureWorldBody,
  ): Promise<AdminAdventureWorld> {
    const m = this.dataSource.manager;
    const set = await m.findOne(CardSet, { where: { id: body.cardSetId } });
    if (!set) throw new BadRequestException('Set introuvable');
    if (await m.findOne(AdventureWorld, { where: { cardSetId: set.id } }))
      throw new BadRequestException('Un monde existe déjà pour ce set');
    await this.checkBooster(m, body.boosterId, set.id);
    await this.checkPrerequisites(m, null, body.prerequisiteIds);
    if (body.isActive) await this.checkActivation(m, set.id, body.boosterId);

    const setCards = await m.find(Card, { where: { cardSet: { id: set.id } } });
    const signatures = defaultSignatures(setCards);
    if (!signatures)
      throw new BadRequestException(
        "Le set ne contient aucune carte d'archétype pipou, pixelman ou dragon",
      );
    let plans;
    try {
      plans = planOpponents(setCards, signatures, this.random);
    } catch (err) {
      throw new BadRequestException(
        `Génération des decks impossible : ${errorMessage(err)}`,
      );
    }

    const world = await this.dataSource.transaction((manager) =>
      persistWorld(
        manager,
        {
          name: body.name,
          cardSetId: set.id,
          boosterId: body.boosterId,
          order: body.order,
          isActive: body.isActive,
          prerequisiteIds: body.prerequisiteIds,
        },
        plans,
        signatures.map((_, i) => ({
          name: `${set.name} — IA ${i + 1}${i === 4 ? ' (boss)' : ''}`,
          quote: 'À toi de jouer !',
        })),
      ),
    );
    return this.view(m, world.id);
  }

  async updateWorld(
    id: number,
    body: AdminAdventureWorldBody,
  ): Promise<AdminAdventureWorld> {
    const m = this.dataSource.manager;
    const world = await m.findOne(AdventureWorld, {
      where: { id },
      relations: { prerequisites: true },
    });
    if (!world) throw new NotFoundException('Monde introuvable');
    if (body.cardSetId !== world.cardSetId)
      throw new BadRequestException(
        "Le set d'un monde ne peut pas être modifié",
      );
    await this.checkBooster(m, body.boosterId, world.cardSetId);
    await this.checkPrerequisites(m, id, body.prerequisiteIds);
    if (body.isActive)
      await this.checkActivation(m, world.cardSetId, body.boosterId);

    await m.save(
      AdventureWorld,
      m.create(AdventureWorld, {
        id,
        name: body.name,
        boosterId: body.boosterId,
        order: body.order,
        isActive: body.isActive,
        prerequisites: body.prerequisiteIds.map(
          (pid) => ({ id: pid }) as AdventureWorld,
        ),
      }),
    );
    return this.view(m, id);
  }

  // ── IA ─────────────────────────────────────────────────────────────────────

  async updateOpponent(
    id: number,
    body: AdminAdventureOpponentBody,
  ): Promise<AdminAdventureWorld> {
    const m = this.dataSource.manager;
    const opponent = await this.findOpponent(m, id);
    const portrait = await m.findOne(Card, {
      where: {
        id: body.portraitCardId,
        cardSet: { id: opponent.world.cardSetId },
      },
    });
    if (!portrait)
      throw new BadRequestException(
        'Le portrait doit être une carte du set du monde',
      );
    if (body.farmCardId != null) {
      const farmCard = await m.findOne(Card, {
        where: {
          id: body.farmCardId,
          cardSet: { id: opponent.world.cardSetId },
        },
      });
      if (!farmCard)
        throw new BadRequestException(
          'La carte de farm doit être une carte du set du monde',
        );
    }
    await m.update(
      AdventureOpponent,
      { id },
      {
        name: body.name,
        quote: body.quote,
        portraitCardId: body.portraitCardId,
        firstWinGold: body.firstWinGold,
        firstWinXp: body.firstWinXp,
        farmGold: body.farmGold,
        farmXp: body.farmXp,
        farmBoosterPct: body.farmBoosterPct,
        farmLegendaryPct: body.farmLegendaryPct,
        farmCardId: body.farmCardId ?? null,
        farmCardPct: body.farmCardPct,
      },
    );
    return this.view(m, opponent.worldId);
  }

  async updateDeck(
    id: number,
    body: AdminAdventureDeckBody,
  ): Promise<AdminAdventureWorld> {
    const m = this.dataSource.manager;
    const opponent = await this.findOpponent(m, id);
    const setCards = new Map(
      (
        await m.find(Card, {
          where: { cardSet: { id: opponent.world.cardSetId } },
        })
      ).map((c) => [c.id, c]),
    );

    // Les doublons de carte sont fusionnés (index unique opponent+carte).
    const quantities = new Map<number, number>();
    for (const e of body.cards) {
      if (!setCards.has(e.cardId))
        throw new BadRequestException(
          `La carte ${e.cardId} n'appartient pas au set du monde`,
        );
      quantities.set(e.cardId, (quantities.get(e.cardId) ?? 0) + e.quantity);
    }
    const problem = checkDeckForMatch(
      [...quantities].map(([cardId, quantity]) => ({
        cardId,
        cardName: setCards.get(cardId)?.name ?? String(cardId),
        quantity,
        owned: quantity,
      })),
    );
    if (problem) throw new BadRequestException(`Deck invalide : ${problem}`);

    await this.replaceDeck(
      id,
      [...quantities].map(([cardId, quantity]) => ({ cardId, quantity })),
    );
    return this.view(m, opponent.worldId);
  }

  async regenerateDeck(id: number): Promise<AdminAdventureWorld> {
    const m = this.dataSource.manager;
    const opponent = await this.findOpponent(m, id);
    const setCards = await m.find(Card, {
      where: { cardSet: { id: opponent.world.cardSetId } },
    });
    const level = opponent.position as 1 | 2 | 3 | 4 | 5;
    let deck;
    try {
      deck = generateDeck(
        setCards,
        level,
        parseSignature(opponent.signature),
        this.random,
      );
    } catch (err) {
      throw new BadRequestException(
        `Génération du deck impossible : ${errorMessage(err)}`,
      );
    }
    await this.replaceDeck(id, deck);
    return this.view(m, opponent.worldId);
  }

  // ── Réglages ───────────────────────────────────────────────────────────────

  async updateSettings(
    body: AdminAdventureSettingsBody,
  ): Promise<{ dailyCap: number }> {
    await this.dataSource.manager.save(
      AdventureSettings,
      this.dataSource.manager.create(AdventureSettings, {
        id: 1,
        dailyCap: body.dailyCap,
      }),
    );
    return { dailyCap: body.dailyCap };
  }

  // ── Interne ────────────────────────────────────────────────────────────────

  private async replaceDeck(
    opponentId: number,
    deck: { cardId: number; quantity: number }[],
  ): Promise<void> {
    // Tout ou rien : on ne laisse jamais une IA sans deck.
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(AdventureOpponentCard, { opponentId });
      await manager.save(
        AdventureOpponentCard,
        deck.map((d) =>
          manager.create(AdventureOpponentCard, {
            opponentId,
            cardId: d.cardId,
            quantity: d.quantity,
          }),
        ),
      );
    });
  }

  private async findOpponent(
    m: EntityManager,
    id: number,
  ): Promise<AdventureOpponent> {
    const opponent = await m.findOne(AdventureOpponent, {
      where: { id },
      relations: { world: true },
    });
    if (!opponent) throw new NotFoundException('IA introuvable');
    return opponent;
  }

  /** Le booster de récompense doit exister et appartenir au set du monde. */
  private async checkBooster(
    m: EntityManager,
    boosterId: number,
    cardSetId: number,
  ) {
    if (!(await m.findOne(Booster, { where: { id: boosterId } })))
      throw new BadRequestException('Booster introuvable');
    const owned = await m.findOne(Booster, {
      where: { id: boosterId, cardSet: { id: cardSetId } },
    });
    if (!owned)
      throw new BadRequestException(
        'Le booster doit appartenir au set du monde',
      );
  }

  private async checkActivation(
    m: EntityManager,
    cardSetId: number,
    boosterId: number | null,
  ) {
    const check = canActivateWorld({
      boosterId,
      legendaryCount: await this.legendaryCount(m, cardSetId),
    });
    if (!check.ok) throw new BadRequestException(check.reason);
  }

  private legendaryCount(m: EntityManager, cardSetId: number): Promise<number> {
    return m.count(Card, {
      where: { cardSet: { id: cardSetId }, rarity: Rarity.LEGENDARY },
    });
  }

  /**
   * Prérequis : mondes existants, pas le monde lui-même, aucun cycle. Un cycle
   * apparaît si l'un des prérequis demandés dépend (directement ou non) du
   * monde édité : on remonte leurs prérequis à la recherche de `worldId`.
   */
  private async checkPrerequisites(
    m: EntityManager,
    worldId: number | null,
    prerequisiteIds: number[],
  ) {
    if (prerequisiteIds.length === 0) return;
    if (worldId !== null && prerequisiteIds.includes(worldId))
      throw new BadRequestException(
        'Un monde ne peut pas être son propre prérequis',
      );
    const all = await m.find(AdventureWorld, {
      relations: { prerequisites: true },
    });
    const requires = new Map(
      all.map((w) => [w.id, (w.prerequisites ?? []).map((p) => p.id)]),
    );
    if (prerequisiteIds.some((p) => !requires.has(p)))
      throw new BadRequestException('Monde prérequis introuvable');
    if (worldId === null) return;

    const seen = new Set<number>();
    const stack = [...prerequisiteIds];
    while (stack.length > 0) {
      const current = stack.pop() as number;
      if (current === worldId)
        throw new BadRequestException(
          'Ces prérequis créeraient un cycle entre les mondes',
        );
      if (seen.has(current)) continue;
      seen.add(current);
      stack.push(...(requires.get(current) ?? []));
    }
  }

  private async dailyCap(m: EntityManager): Promise<number> {
    const settings = await m.findOne(AdventureSettings, { where: { id: 1 } });
    return settings?.dailyCap ?? ADVENTURE_DAILY_CAP_DEFAULT;
  }

  private async view(
    m: EntityManager,
    id: number,
  ): Promise<AdminAdventureWorld> {
    const world = await m.findOne(AdventureWorld, {
      where: { id },
      relations: WORLD_RELATIONS,
    });
    if (!world) throw new NotFoundException('Monde introuvable');
    return this.toView(m, world);
  }

  private async toView(
    m: EntityManager,
    w: AdventureWorld,
  ): Promise<AdminAdventureWorld> {
    const check = canActivateWorld({
      boosterId: w.boosterId,
      legendaryCount: await this.legendaryCount(m, w.cardSetId),
    });
    return {
      id: w.id,
      name: w.name,
      cardSetId: w.cardSetId,
      cardSetName: w.cardSet?.name ?? '',
      boosterId: w.boosterId,
      order: w.order,
      isActive: w.isActive,
      prerequisiteIds: (w.prerequisites ?? []).map((p) => p.id),
      inactiveReason: check.ok ? null : check.reason,
      opponents: [...(w.opponents ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((o) => opponentView(o)),
    };
  }
}

function opponentView(o: AdventureOpponent): AdminAdventureOpponent {
  const cards = (o.cards ?? []).filter((c) => c.card);
  const problem = checkDeckForMatch(
    cards.map((c) => ({
      cardId: c.cardId,
      cardName: c.card.name,
      quantity: c.quantity,
      owned: c.quantity,
    })),
  );
  let archetype: AdventureArchetype | null = null;
  try {
    const a = parseSignature(o.signature).archetype;
    if (ARCHETYPES.includes(a)) archetype = a;
  } catch {
    // signature illisible : archétype inconnu
  }
  return {
    id: o.id,
    position: o.position,
    name: o.name,
    quote: o.quote,
    portraitCardId: o.portraitCardId,
    archetype,
    firstWinGold: o.firstWinGold,
    firstWinXp: o.firstWinXp,
    farmGold: o.farmGold,
    farmXp: o.farmXp,
    farmBoosterPct: o.farmBoosterPct,
    farmLegendaryPct: o.farmLegendaryPct,
    farmCardId: o.farmCardId,
    farmCardPct: o.farmCardPct,
    deck: cards
      .map((c) => ({
        cardId: c.cardId,
        name: c.card.name,
        rarity: c.card.rarity,
        quantity: c.quantity,
      }))
      .sort((a, b) => a.cardId - b.cardId),
    deckSize: cards.reduce((s, c) => s + c.quantity, 0),
    deckError: problem,
  };
}

function parseSignature(raw: string): Signature {
  const sig = JSON.parse(raw) as Partial<Signature>;
  if (!sig.archetype || !sig.cardName) throw new Error('signature incomplète');
  return sig as Signature;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
