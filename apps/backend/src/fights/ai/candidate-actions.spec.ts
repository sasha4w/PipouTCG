import { HAND_LIMIT, Rarity } from '@pipou/shared';
import { fillerCard, monsterCard, persistentCard } from '../testing/cards';
import { realCard } from '../testing/real-cards';
import { scenario } from '../testing/scenario';
import { listCandidates } from './candidate-actions';

const pipou = (n: string) => monsterCard(n, { archetype: 'pipou' });
const adulte = (element: 'fire' | 'water' | 'earth' | 'wind') =>
  monsterCard(`Adulte ${element}`, {
    archetype: 'dragon',
    stage: 'adult',
    element,
  });
const types = (actions: { type: string }[]) => actions.map((a) => a.type);

describe('listCandidates : phase de contrôle', () => {
  it('propose un support en main', () => {
    const game = scenario({
      phase: 'end',
      p1: { hand: [persistentCard('Aura', [])] },
    });
    expect(types(listCandidates(game, 'p1'))).toContain('play_support');
  });

  it('propose la Relève, mais pas une invocation normale', () => {
    const game = scenario({
      phase: 'end',
      p1: {
        hand: [realCard('Général Chatouille'), monsterCard('Banal')],
        monsters: [pipou('A'), pipou('B'), pipou('C')],
      },
    });
    const summons = listCandidates(game, 'p1').filter(
      (a) => a.type === 'summon',
    );
    expect(summons.length).toBeGreaterThan(0);
    for (const s of summons) {
      expect(s.releveInstanceIds?.length).toBeGreaterThan(0);
      expect(s.handIndex).toBe(0);
    }
  });

  it('propose le Drakon des Origines avec les 4 éléments, sans Relève', () => {
    const game = scenario({
      phase: 'end',
      p1: {
        hand: [realCard('Drakon des Origines')],
        recycleEnergy: 10,
        graveyard: [
          adulte('fire'),
          adulte('water'),
          adulte('earth'),
          adulte('wind'),
        ],
      },
    });
    expect(types(listCandidates(game, 'p1'))).toContain('summon');
  });

  it('aucune invocation normale ni recycle, transform, mode, attaque', () => {
    const game = scenario({
      phase: 'end',
      p1: {
        hand: [monsterCard('Banal'), fillerCard()],
        monsters: [pipou('A')],
      },
      p2: { monsters: [pipou('X')] },
    });
    const t = types(listCandidates(game, 'p1'));
    for (const banned of [
      'summon',
      'recycle',
      'transform',
      'change_mode',
      'attack',
    ])
      expect(t).not.toContain(banned);
  });

  it('main <= HAND_LIMIT : end_phase proposé', () => {
    const game = scenario({
      phase: 'end',
      p1: { hand: [persistentCard('Aura', [])] },
    });
    expect(types(listCandidates(game, 'p1'))).toContain('end_phase');
  });

  it('main > HAND_LIMIT : défausses et coups de contrôle, pas end_phase', () => {
    const hand = Array.from({ length: HAND_LIMIT + 1 }, (_, i) =>
      fillerCard(`F${i}`),
    );
    hand[0] = persistentCard('Aura', []);
    const game = scenario({ phase: 'end', p1: { hand } });
    const t = types(listCandidates(game, 'p1'));
    expect(t).toContain('discard');
    expect(t).toContain('play_support');
    expect(t).not.toContain('end_phase');
  });
});

describe('listCandidates : cartes secrètes des boss', () => {
  const pipouHigh = (n: number) =>
    Array.from({ length: n }, (_, i) =>
      monsterCard(`Haut ${i}`, { archetype: 'pipou', rarity: Rarity.EPIC }),
    );
  const summonsOf = (game: ReturnType<typeof scenario>) =>
    listCandidates(game, 'p1').filter((a) => a.type === 'summon');

  it('ne propose pas Magouille sans 4 Pipou épiques/légendaires au cimetière', () => {
    const game = scenario({
      phase: 'main',
      p1: {
        hand: [realCard('Maître Magouille')],
        recycleEnergy: 10,
        graveyard: pipouHigh(3),
      },
    });
    expect(summonsOf(game)).toHaveLength(0);
  });

  it('propose Magouille avec 4 Pipou épiques/légendaires au cimetière', () => {
    const game = scenario({
      phase: 'main',
      p1: {
        hand: [realCard('Maître Magouille')],
        recycleEnergy: 10,
        graveyard: pipouHigh(4),
      },
    });
    expect(summonsOf(game).length).toBeGreaterThan(0);
  });

  it('ne propose jamais Noyau Delta depuis la main', () => {
    const game = scenario({
      phase: 'main',
      p1: { hand: [realCard('Noyau Delta')], recycleEnergy: 10 },
    });
    expect(summonsOf(game)).toHaveLength(0);
  });

  it('propose de poser Protocole Delta .core', () => {
    const game = scenario({
      phase: 'main',
      p1: { hand: [realCard('Protocole Delta .core')], recycleEnergy: 10 },
    });
    expect(types(listCandidates(game, 'p1'))).toContain('play_support');
  });
});
