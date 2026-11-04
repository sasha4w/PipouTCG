import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DecksService } from './decks.service';
import { Deck } from './deck.entity';
import { DeckCard } from './deck-card.entity';
import { UserCard } from '../users/user-card.entity';

const deckRepo = { find: jest.fn(), findOne: jest.fn(), update: jest.fn() };

async function service() {
  const moduleRef = await Test.createTestingModule({
    providers: [
      DecksService,
      { provide: getRepositoryToken(Deck), useValue: deckRepo },
      { provide: getRepositoryToken(DeckCard), useValue: {} },
      { provide: getRepositoryToken(UserCard), useValue: {} },
      { provide: DataSource, useValue: {} },
    ],
  }).compile();
  return moduleRef.get(DecksService);
}

describe('DecksService — favoris et dernier deck', () => {
  beforeEach(() => jest.resetAllMocks());

  it('setFavorite met à jour le deck du joueur et le renvoie', async () => {
    const s = await service();
    deckRepo.findOne
      .mockResolvedValueOnce({ id: 4, userId: 7, isFavorite: false })
      .mockResolvedValueOnce({ id: 4, userId: 7, isFavorite: true });
    const deck = await s.setFavorite(4, 7, true);
    expect(deckRepo.update).toHaveBeenCalledWith(
      { id: 4 },
      { isFavorite: true },
    );
    expect(deck.isFavorite).toBe(true);
  });

  it("setFavorite refuse le deck d'un autre joueur", async () => {
    const s = await service();
    deckRepo.findOne.mockResolvedValue({ id: 4, userId: 8 });
    await expect(s.setFavorite(4, 7, true)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(deckRepo.update).not.toHaveBeenCalled();
  });

  it('setFavorite : deck introuvable', async () => {
    const s = await service();
    deckRepo.findOne.mockResolvedValue(null);
    await expect(s.setFavorite(4, 7, true)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('markUsed date le deck du joueur', async () => {
    const s = await service();
    await s.markUsed(4, 7);
    expect(deckRepo.update).toHaveBeenCalledWith(
      { id: 4, userId: 7 },
      { lastUsedAt: expect.any(Date) as Date },
    );
  });

  it('findAllByUser charge la carte de chaque exemplaire (jouabilité côté front)', async () => {
    const s = await service();
    deckRepo.find.mockResolvedValue([]);
    await s.findAllByUser(7);
    expect(deckRepo.find).toHaveBeenCalledWith({
      where: { userId: 7 },
      relations: ['deckCards', 'deckCards.userCard', 'deckCards.userCard.card'],
    });
  });
});
