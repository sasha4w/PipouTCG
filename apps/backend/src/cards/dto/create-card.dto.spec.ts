import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCardDto } from './create-card.dto';
import { UpdateCardDto } from './update-card.dto';

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

  it('accepte une quantité conditionnelle (valueIf)', async () => {
    const errors = await errorsFor([
      {
        trigger: 'ON_PLAY',
        actions: [
          {
            type: 'RETURN_FROM_GRAVEYARD',
            target: 'PLAYER',
            value: 2,
            valueIf: {
              condition: {
                type: 'SPECIFIC_CARD_ON_BOARD',
                value: 'Capitaine',
                match: 'contains',
              },
              value: 3,
            },
          },
        ],
      },
    ]);
    expect(errors).toEqual([]);
  });

  it('refuse un valueIf sans valeur numérique', async () => {
    const errors = await errorsFor([
      {
        trigger: 'ON_PLAY',
        actions: [
          {
            type: 'DRAW',
            target: 'PLAYER',
            valueIf: { condition: { type: 'HAND_SIZE_MIN', value: 1 } },
          },
        ],
      },
    ]);
    expect(errors).not.toEqual([]);
  });

  it('refuse un valueIf sans condition', async () => {
    const errors = await errorsFor([
      {
        trigger: 'ON_PLAY',
        actions: [{ type: 'DRAW', target: 'PLAYER', valueIf: { value: 3 } }],
      },
    ]);
    expect(errors).not.toEqual([]);
  });
});

describe('CreateCardDto — Drakon', () => {
  it('accepte élément, lignée et stade de Drakon', async () => {
    const dto = plainToInstance(CreateCardDto, {
      name: 'Bébé Test',
      rarity: 'common',
      type: 'monster',
      atk: 100,
      hp: 500,
      cardSetId: 3,
      element: 'fire',
      lineage: 'feros',
      stage: 'baby',
    });
    expect(
      await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).toEqual([]);
  });

  it('refuse un élément inconnu', async () => {
    const dto = plainToInstance(CreateCardDto, {
      name: 'Bébé Test',
      rarity: 'common',
      type: 'monster',
      atk: 0,
      hp: 1,
      cardSetId: 3,
      element: 'lava',
    });
    expect(
      await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).not.toEqual([]);
  });
});

describe('CreateCardDto — corps multipart du formulaire admin', () => {
  it('accepte les effets envoyés en JSON texte (FormData)', async () => {
    const dto = plainToInstance(CreateCardDto, {
      name: 'Éphémère test',
      rarity: 'common',
      type: 'support',
      atk: '0',
      hp: '0',
      cost: '0',
      cardSetId: '1',
      supportType: 'EPHEMERAL',
      effects: JSON.stringify([
        {
          trigger: 'ON_PLAY',
          actions: [{ type: 'DEAL_DAMAGE', target: 'ENEMY_MONSTER', value: 100 }],
        },
      ]),
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors).toEqual([]);
    expect(Array.isArray(dto.effects)).toBe(true);
  });

  it('refuse des effets en JSON malformé', async () => {
    const dto = plainToInstance(CreateCardDto, {
      name: 'Carte test',
      rarity: 'common',
      type: 'support',
      atk: '0',
      hp: '0',
      cardSetId: '1',
      effects: '[{oops',
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors).not.toEqual([]);
  });

  it('UpdateCardDto parse aussi les effets texte', async () => {
    const dto = plainToInstance(UpdateCardDto, {
      effects: JSON.stringify([
        { trigger: 'ON_PLAY', actions: [{ type: 'SET_TAUNT', target: 'SELF' }] },
      ]),
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors).toEqual([]);
    expect(Array.isArray(dto.effects)).toBe(true);
  });
});

describe('CreateCardDto — sous-types de support', () => {
  const base = {
    name: 'Test',
    rarity: 'common',
    type: 'support',
    atk: 0,
    hp: 0,
    cardSetId: 1,
  };
  const errorsOf = async (extra: object) =>
    validate(plainToInstance(CreateCardDto, { ...base, ...extra }));

  it('équipement sans emplacement refusé', async () => {
    expect(await errorsOf({ supportType: 'EQUIPMENT' })).not.toHaveLength(0);
  });
  it('équipement avec emplacement accepté', async () => {
    expect(
      await errorsOf({ supportType: 'EQUIPMENT', equipmentSlot: 'ACCESSORY' }),
    ).toHaveLength(0);
  });
  it('emplacement interdit hors équipement', async () => {
    expect(
      await errorsOf({ supportType: 'EPHEMERAL', equipmentSlot: 'OFFENSIVE' }),
    ).not.toHaveLength(0);
  });
  it('emplacement interdit sans supportType', async () => {
    expect(await errorsOf({ equipmentSlot: 'OFFENSIVE' })).not.toHaveLength(0);
  });
  it('charge : chargeMax ≥ 1 obligatoire', async () => {
    expect(await errorsOf({ supportType: 'CHARGE' })).not.toHaveLength(0);
    expect(
      await errorsOf({ supportType: 'CHARGE', chargeMax: 0 }),
    ).not.toHaveLength(0);
    expect(
      await errorsOf({
        supportType: 'CHARGE',
        chargeMax: 3,
        chargeMode: 'ONE_SHOT',
      }),
    ).toHaveLength(0);
  });
  it('Terrain : uniquement sur un Persistant', async () => {
    expect(
      await errorsOf({ supportType: 'PERSISTENT', isTerrain: true }),
    ).toHaveLength(0);
    expect(
      await errorsOf({
        supportType: 'EQUIPMENT',
        equipmentSlot: 'OFFENSIVE',
        isTerrain: true,
      }),
    ).not.toHaveLength(0);
  });
  it('formes multipart : booleen et nombre en chaine', async () => {
    expect(
      await errorsOf({ supportType: 'PERSISTENT', isTerrain: 'true' }),
    ).toHaveLength(0);
    expect(
      await errorsOf({ supportType: 'PERSISTENT', isTerrain: 'false' }),
    ).toHaveLength(0);
    expect(
      await errorsOf({ supportType: 'CHARGE', chargeMax: '3' }),
    ).toHaveLength(0);
    const dto = plainToInstance(CreateCardDto, {
      ...base,
      supportType: 'PERSISTENT',
      isTerrain: 'true',
    });
    expect(dto.isTerrain).toBe(true);
  });
});
