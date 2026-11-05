import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import {
  Archetype,
  DECK_RULES,
  STARTER_FEATURED_COUNT,
  STARTER_GOLD,
} from '@pipou/shared';
import type {
  ClaimStarterResult,
  StarterDeckCardView,
  StarterDeckView,
  StarterDeckBody,
  StarterStatus,
} from '@pipou/shared';
import { StarterDeck } from './starter-deck.entity';
import { StarterDeckCard } from './starter-deck-card.entity';
import { Card } from '../cards/card.entity';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { Deck } from '../decks/deck.entity';
import { DeckCard } from '../decks/deck-card.entity';

const DECK_NAMES: Record<Archetype, string> = {
  [Archetype.PIPOU]: 'Starter Pipou',
  [Archetype.PIXELMAN]: 'Starter Pixelman',
  [Archetype.DRAGON]: 'Starter Drakon',
};

/** Deck valide : taille et copies conformes aux règles, exactement 4 phares. */
export function isDeckValid(cards: StarterDeckCardView[]): boolean {
  const total = cards.reduce((sum, c) => sum + c.quantity, 0);
  if (total < DECK_RULES.MIN_CARDS || total > DECK_RULES.MAX_CARDS) {
    return false;
  }
  if (cards.some((c) => c.quantity < 1 || c.quantity > DECK_RULES.MAX_COPIES)) {
    return false;
  }
  if (new Set(cards.map((c) => c.cardId)).size !== cards.length) return false;
  return cards.filter((c) => c.isFeatured).length === STARTER_FEATURED_COUNT;
}

function toView(deck: StarterDeck): StarterDeckView {
  const cards = (deck.cards ?? []).map((c) => ({
    cardId: c.cardId,
    quantity: c.quantity,
    isFeatured: c.isFeatured,
  }));
  return { archetype: deck.archetype, isValid: isDeckValid(cards), cards };
}

/** Un deck valide pour chaque archétype, dans l'ordre de l'enum. */
function completeViews(decks: StarterDeck[]): StarterDeckView[] | null {
  const views: StarterDeckView[] = [];
  for (const archetype of Object.values(Archetype)) {
    const deck = decks.find((d) => d.archetype === archetype);
    if (!deck) return null;
    const view = toView(deck);
    if (!view.isValid) return null;
    views.push(view);
  }
  return views;
}

@Injectable()
export class StarterDecksService {
  constructor(
    @InjectRepository(StarterDeck)
    private starterRepo: Repository<StarterDeck>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private users: UsersService,
    private dataSource: DataSource,
  ) {}

  async getStatus(userId: number): Promise<StarterStatus> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const claimed = !!user?.starterClaimedAt;
    if (claimed) return { claimed, available: false, decks: [] };

    const decks = await this.starterRepo.find({ relations: ['cards'] });
    const views = completeViews(decks);
    if (!views) return { claimed, available: false, decks: [] };
    return { claimed, available: true, decks: views };
  }

  async claim(
    userId: number,
    archetype: Archetype,
  ): Promise<ClaimStarterResult> {
    return this.dataSource.transaction(async (manager) => {
      // Marqueur en premier : l'UPDATE conditionnel sérialise les clics doubles.
      const marked = await manager.update(
        User,
        { id: userId, starterClaimedAt: IsNull() },
        { starterClaimedAt: () => 'NOW()' },
      );
      if (!marked.affected) {
        throw new ConflictException('Starter deck déjà réclamé');
      }

      const decks = await manager.find(StarterDeck, { relations: ['cards'] });
      if (!completeViews(decks)) {
        throw new BadRequestException(
          'Les starter decks ne sont pas disponibles pour le moment',
        );
      }
      const chosen = decks.find((d) => d.archetype === archetype)!;

      // addCardToUser ajoute à l'éventuelle ligne existante et renvoie la
      // user_card finale : le DeckCard doit pointer dessus.
      const rows: { userCardId: number; quantity: number }[] = [];
      for (const card of chosen.cards) {
        const uc = await this.users.addCardToUser(
          userId,
          card.cardId,
          card.quantity,
          manager,
        );
        rows.push({ userCardId: uc.id, quantity: card.quantity });
      }
      await this.users.addGold(userId, STARTER_GOLD, manager);

      const deck = await manager.save(
        Deck,
        manager.create(Deck, { name: DECK_NAMES[archetype], userId }),
      );
      await manager.save(
        DeckCard,
        rows.map((r) =>
          manager.create(DeckCard, {
            deckId: deck.id,
            userCardId: r.userCardId,
            quantity: r.quantity,
          }),
        ),
      );

      const user = await manager.findOne(User, { where: { id: userId } });
      return { archetype, deckId: deck.id, gold: user?.gold ?? 0 };
    });
  }

  /** Les 3 decks pour l'admin, invalides ou absents compris. */
  async adminList(): Promise<StarterDeckView[]> {
    const decks = await this.starterRepo.find({ relations: ['cards'] });
    return Object.values(Archetype).map((archetype) => {
      const deck = decks.find((d) => d.archetype === archetype);
      return deck ? toView(deck) : { archetype, isValid: false, cards: [] };
    });
  }

  /** Remplace la composition ; tout est validé avant de supprimer quoi que ce soit. */
  async saveDeck(
    archetype: Archetype,
    body: StarterDeckBody,
  ): Promise<StarterDeckView> {
    const cards = body.cards.map((c) => ({
      cardId: c.cardId,
      quantity: c.quantity,
      isFeatured: c.isFeatured,
    }));
    if (!isDeckValid(cards)) {
      throw new BadRequestException(
        'Composition invalide : 30 à 40 cartes, 3 copies max, 4 phares',
      );
    }
    return this.dataSource.transaction(async (manager) => {
      const found = await manager.count(Card, {
        where: { id: In(cards.map((c) => c.cardId)) },
      });
      if (found !== cards.length) {
        throw new BadRequestException('Carte inexistante dans la composition');
      }
      const deck =
        (await manager.findOne(StarterDeck, { where: { archetype } })) ??
        (await manager.save(
          StarterDeck,
          manager.create(StarterDeck, { archetype }),
        ));
      await manager.delete(StarterDeckCard, { starterDeckId: deck.id });
      await manager.save(
        StarterDeckCard,
        cards.map((c) =>
          manager.create(StarterDeckCard, { ...c, starterDeckId: deck.id }),
        ),
      );
      return { archetype, isValid: true, cards };
    });
  }
}
