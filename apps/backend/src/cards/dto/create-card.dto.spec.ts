import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCardDto } from './create-card.dto';

async function errorsFor(effects: unknown) {
  const dto = plainToInstance(CreateCardDto, {
    name: 'Carte test',
    rarity: 'common',
    type: 'support',
    atk: 0,
    hp: 0,
    cardSetId: 1,
    effects,
  });
  return validate(dto, { whitelist: true, forbidNonWhitelisted: true });
}

describe('CreateCardDto — effets', () => {
  it("accepte un filtre d'action", async () => {
    const errors = await errorsFor([
      {
        trigger: 'ON_DEATH',
        actions: [
          {
            type: 'SEARCH_DECK',
            target: 'PLAYER',
            filter: {
              name: 'Noyau',
              archetype: 'pixelman',
              rarities: ['common'],
              type: 'monster',
            },
          },
        ],
      },
    ]);
    expect(errors).toEqual([]);
  });

  it("accepte EQUIPPED_ON avec match 'contains'", async () => {
    const errors = await errorsFor([
      {
        trigger: 'PASSIVE',
        condition: { type: 'EQUIPPED_ON', value: 'Noyau', match: 'contains' },
        actions: [{ type: 'SET_TAUNT', target: 'SELF' }],
      },
    ]);
    expect(errors).toEqual([]);
  });

  it('refuse un champ inconnu dans un filtre', async () => {
    const errors = await errorsFor([
      {
        trigger: 'ON_PLAY',
        actions: [
          { type: 'SEARCH_DECK', target: 'PLAYER', filter: { foo: 1 } },
        ],
      },
    ]);
    expect(errors).not.toEqual([]);
  });

  it('refuse DEAL_DAMAGE visant un joueur', async () => {
    const errors = await errorsFor([
      {
        trigger: 'ON_PLAY',
        actions: [{ type: 'DEAL_DAMAGE', target: 'OPPONENT', value: 100 }],
      },
    ]);
    expect(errors).not.toEqual([]);
  });
});
