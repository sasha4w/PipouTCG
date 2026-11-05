import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Archetype, STARTER_GOLD } from '@pipou/shared';
import type { StarterDeckCardView } from '@pipou/shared';
import { StarterDecksService, isDeckValid } from './starter-decks.service';
import { StarterDeck } from './starter-deck.entity';
import { User } from '../users/user.entity';
import { Deck } from '../decks/deck.entity';
import { DeckCard } from '../decks/deck-card.entity';
import { UsersService } from '../users/users.service';

/** 10 cartes x3 = 30 cartes, 4 phares. */
function validCards(offset = 0): StarterDeckCardView[] {
  return Array.from({ length: 10 }, (_, i) => ({
    cardId: offset + i + 1,
    quantity: 3,
    isFeatured: i < 4,
  }));
}

function starterDeck(archetype: string, cards = validCards()) {
  return { id: 1, archetype, cards };
}

const allDecks = () => [
  starterDeck(Archetype.PIPOU, validCards(0)),
  starterDeck(Archetype.DRAGON, validCards(100)),
  starterDeck(Archetype.PIXELMAN, validCards(200)),
];

describe('isDeckValid', () => {
  it('vrai à 30 cartes et 4 phares', () => {
    expect(isDeckValid(validCards())).toBe(true);
  });
  it('faux à 29 cartes', () => {
    const c = validCards();
    c[9].quantity = 2;
    expect(isDeckValid(c)).toBe(false);
  });
  it('faux à 41 cartes', () => {
    const c = validCards();
    c.push({ cardId: 99, quantity: 3, isFeatured: false });
    c.push({ cardId: 98, quantity: 3, isFeatured: false });
    c.push({ cardId: 97, quantity: 3, isFeatured: false });
    c.push({ cardId: 96, quantity: 2, isFeatured: false });
    expect(c.reduce((s, x) => s + x.quantity, 0)).toBe(41);
    expect(isDeckValid(c)).toBe(false);
  });
  it('faux avec 4 copies', () => {
    const c = validCards();
    c[0].quantity = 4;
    c[1].quantity = 2;
    expect(isDeckValid(c)).toBe(false);
  });
  it('faux avec 3 phares', () => {
    const c = validCards();
    c[3].isFeatured = false;
    expect(isDeckValid(c)).toBe(false);
  });
  it('faux avec 5 phares', () => {
    const c = validCards();
    c[4].isFeatured = true;
    expect(isDeckValid(c)).toBe(false);
  });
});

describe('StarterDecksService', () => {
  const starterRepo = { find: jest.fn() };
  const userRepo = { findOne: jest.fn() };
  const users = { addCardToUser: jest.fn(), addGold: jest.fn() };
  const manager = {
    update: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  };
  const dataSource = { transaction: jest.fn() };

  async function service() {
    const moduleRef = await Test.createTestingModule({
      providers: [
        StarterDecksService,
        { provide: getRepositoryToken(StarterDeck), useValue: starterRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: UsersService, useValue: users },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();
    return moduleRef.get(StarterDecksService);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    manager.create.mockImplementation((_e: unknown, v: unknown) => v);
    dataSource.transaction.mockImplementation(
      (cb: (m: typeof manager) => Promise<unknown>) => cb(manager),
    );
  });

  describe('getStatus', () => {
    it('disponible avec les 3 decks quand non réclamé et valides', async () => {
      const s = await service();
      userRepo.findOne.mockResolvedValue({ id: 7, starterClaimedAt: null });
      starterRepo.find.mockResolvedValue(allDecks());
      const st = await s.getStatus(7);
      expect(st.available).toBe(true);
      expect(st.claimed).toBe(false);
      expect(st.decks).toHaveLength(3);
    });

    it('indisponible si déjà réclamé', async () => {
      const s = await service();
      userRepo.findOne.mockResolvedValue({
        id: 7,
        starterClaimedAt: new Date(),
      });
      starterRepo.find.mockResolvedValue(allDecks());
      const st = await s.getStatus(7);
      expect(st).toEqual({ claimed: true, available: false, decks: [] });
    });

    it('indisponible si un deck est invalide', async () => {
      const s = await service();
      userRepo.findOne.mockResolvedValue({ id: 7, starterClaimedAt: null });
      const decks = allDecks();
      decks[1].cards[0].quantity = 4;
      starterRepo.find.mockResolvedValue(decks);
      const st = await s.getStatus(7);
      expect(st).toEqual({ claimed: false, available: false, decks: [] });
    });

    it('indisponible si un deck manque', async () => {
      const s = await service();
      userRepo.findOne.mockResolvedValue({ id: 7, starterClaimedAt: null });
      starterRepo.find.mockResolvedValue(allDecks().slice(0, 2));
      const st = await s.getStatus(7);
      expect(st.available).toBe(false);
      expect(st.decks).toEqual([]);
    });
  });

  describe('claim', () => {
    function setupOk(userCardIdOf: (cardId: number) => number) {
      manager.update.mockResolvedValue({ affected: 1 });
      manager.find.mockResolvedValue(allDecks());
      users.addCardToUser.mockImplementation((_u: number, cardId: number) =>
        Promise.resolve({ id: userCardIdOf(cardId) }),
      );
      manager.save.mockImplementation(
        (_e: unknown, v: Record<string, unknown>) =>
          Promise.resolve(Array.isArray(v) ? v : { ...v, id: 55 }),
      );
      manager.findOne.mockResolvedValue({ id: 7, gold: 5100 });
    }

    it('donne or et cartes, crée le deck au bon nom', async () => {
      const s = await service();
      setupOk((id) => id + 1000);
      const res = await s.claim(7, Archetype.DRAGON);
      expect(users.addGold).toHaveBeenCalledTimes(1);
      expect(users.addGold).toHaveBeenCalledWith(7, STARTER_GOLD, manager);
      expect(users.addCardToUser).toHaveBeenCalledTimes(10);
      expect(users.addCardToUser).toHaveBeenCalledWith(7, 101, 3, manager);
      expect(manager.create).toHaveBeenCalledWith(
        Deck,
        expect.objectContaining({ name: 'Starter Drakon', userId: 7 }),
      );
      expect(res).toEqual({
        archetype: Archetype.DRAGON,
        deckId: 55,
        gold: 5100,
      });
    });

    it('nomme les decks Starter Pipou et Starter Pixelman', async () => {
      const s = await service();
      setupOk((id) => id);
      await s.claim(7, Archetype.PIPOU);
      await s.claim(7, Archetype.PIXELMAN);
      const names = (manager.create.mock.calls as [unknown, { name: string }][])
        .filter((c) => c[0] === Deck)
        .map((c) => c[1].name);
      expect(names).toEqual(['Starter Pipou', 'Starter Pixelman']);
    });

    it('déjà réclamé : Conflict, rien donné', async () => {
      const s = await service();
      manager.update.mockResolvedValue({ affected: 0 });
      await expect(s.claim(7, Archetype.PIPOU)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(users.addGold).not.toHaveBeenCalled();
      expect(users.addCardToUser).not.toHaveBeenCalled();
    });

    it('deck invalide : BadRequest, rien donné', async () => {
      const s = await service();
      manager.update.mockResolvedValue({ affected: 1 });
      const decks = allDecks();
      decks[2].cards[0].isFeatured = false;
      manager.find.mockResolvedValue(decks);
      await expect(s.claim(7, Archetype.PIPOU)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(users.addGold).not.toHaveBeenCalled();
      expect(users.addCardToUser).not.toHaveBeenCalled();
    });

    it('cartes déjà possédées : le DeckCard utilise le userCardId existant', async () => {
      const s = await service();
      setupOk((id) => (id === 201 ? 9999 : id + 5000));
      await s.claim(7, Archetype.PIXELMAN);
      const calls = manager.save.mock.calls as [unknown, unknown][];
      const saved = calls.find((c) => c[0] === DeckCard);
      const rows = saved![1] as { userCardId: number; quantity: number }[];
      expect(rows).toHaveLength(10);
      expect(rows.map((r) => r.userCardId)).toContain(9999);
      expect(rows.every((r) => r.quantity === 3)).toBe(true);
    });
  });
  describe('adminList', () => {
    it('renvoie 3 vues, dont les invalides et les manquants', async () => {
      const s = await service();
      const decks = allDecks().slice(0, 2);
      decks[1].cards[0].quantity = 4;
      starterRepo.find.mockResolvedValue(decks);
      const views = await s.adminList();
      expect(views.map((v) => v.archetype)).toEqual(Object.values(Archetype));
      expect(views.map((v) => v.isValid)).toEqual([true, false, false]);
    });
  });

  describe('saveDeck', () => {
    it('refuse 29 cartes sans toucher aux lignes', async () => {
      const s = await service();
      const cards = validCards();
      cards[9].quantity = 2;
      await expect(
        s.saveDeck(Archetype.PIPOU, { cards }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(manager.delete).not.toHaveBeenCalled();
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('refuse une carte inexistante sans toucher aux lignes', async () => {
      const s = await service();
      manager.count.mockResolvedValue(9);
      manager.findOne.mockResolvedValue({ id: 5, archetype: Archetype.PIPOU });
      await expect(
        s.saveDeck(Archetype.PIPOU, { cards: validCards() }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(manager.delete).not.toHaveBeenCalled();
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('accepte une liste valide et remplace les lignes', async () => {
      const s = await service();
      manager.count.mockResolvedValue(10);
      manager.findOne.mockResolvedValue({ id: 5, archetype: Archetype.PIPOU });
      manager.delete.mockResolvedValue({ affected: 10 });
      manager.save.mockImplementation((_e: unknown, v: unknown) => v);
      const view = await s.saveDeck(Archetype.PIPOU, { cards: validCards() });
      expect(manager.delete).toHaveBeenCalledTimes(1);
      expect(view.isValid).toBe(true);
      expect(view.archetype).toBe(Archetype.PIPOU);
      expect(view.cards).toHaveLength(10);
    });
  });
});
