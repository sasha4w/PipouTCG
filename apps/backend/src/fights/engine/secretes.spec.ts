import { createEngine } from '../testing/engine';
import { monsterCard } from '../testing/cards';
import { realCard } from '../testing/real-cards';
import { passTurn, scenario } from '../testing/scenario';

const engine = createEngine();

const pipouHigh = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    monsterCard(`Pipou haut ${i}`, {
      archetype: 'pipou',
      rarity: i % 2 ? 'legendary' : 'epic',
    }),
  );

function setupWithHand(name: string, graveyard = pipouHigh(0)) {
  return scenario({
    turn: 'p1',
    phase: 'main',
    p1: { hand: [realCard(name)], recycleEnergy: 10, graveyard },
  });
}

const summonFromHand = (game: ReturnType<typeof setupWithHand>) =>
  engine.dispatch(game, 'p1', {
    type: 'summon',
    handIndex: 0,
    zoneIndex: 0,
    paymentHandIndices: [],
  });

describe('invocation des secrètes', () => {
  it('Magouille refusé avec 3 Pipou épiques/légendaires au cimetière', () => {
    const game = setupWithHand('Maître Magouille', pipouHigh(3));
    expect(summonFromHand(game).error).toBe(
      'Il faut 4 monstres Pipou Épiques ou Légendaires au cimetière',
    );
  });
  it('Magouille accepté avec 4', () => {
    const game = setupWithHand('Maître Magouille', pipouHigh(4));
    expect(summonFromHand(game).error).toBeUndefined();
  });
  it('Delta toujours refusé depuis la main', () => {
    const game = setupWithHand('Noyau Delta');
    expect(summonFromHand(game).error).toBe(
      'Noyau Delta ne peut arriver en jeu que par un effet',
    );
  });
});

type Game = ReturnType<typeof scenario>;
const names = (cards: { baseCard: { name: string } }[]) =>
  cards.map((c) => c.baseCard.name);

function setupWithCharge(
  name: string,
  opts: {
    counters?: number;
    hand?: string[];
    deck?: string[];
    board?: string[];
  } = {},
): Game {
  const game = scenario({
    turn: 'p1',
    phase: 'main',
    p1: {
      supports: [realCard(name)],
      hand: (opts.hand ?? []).map(realCard),
      deck: (opts.deck ?? []).map(realCard),
      monsters: (opts.board ?? []).map(realCard),
      recycleEnergy: 10,
    },
  });
  game.player1.supportZones[0]!.chargeCounters = opts.counters ?? 0;
  return game;
}
const chargeOf = (g: Game) => g.player1.supportZones[0]!;
const startTurn = (g: Game) => {
  passTurn(engine, g);
  passTurn(engine, g);
};
const equip = (g: Game, support: string, target: string) => {
  const handIndex = g.player1.hand.findIndex(
    (c) => c.baseCard.name === support,
  );
  const monster = g.player1.monsterZones.find(
    (m) => m?.card.baseCard.name === target,
  )!;
  const res = engine.dispatch(g, 'p1', {
    type: 'play_support',
    handIndex,
    targetInstanceId: monster.instanceId,
  });
  expect(res.error).toBeUndefined();
};
const pickByName = (g: Game, name: string) => {
  const c = g.pendingChoices[0].candidates.find(
    (x) => x.baseCard.name === name,
  )!;
  expect(
    engine.dispatch(g, 'p1', {
      type: 'pick_cards',
      instanceIds: [c.instanceId],
    }).error,
  ).toBeUndefined();
};
const confirmPick = (g: Game) =>
  pickByName(g, g.pendingChoices[0].candidates[0].baseCard.name);
const boardNames = (g: Game) =>
  g.player1.monsterZones.filter((m) => m).map((m) => m!.card.baseCard.name);
const handNames = (g: Game) => names(g.player1.hand);
const deckNames = (g: Game) => names(g.player1.deck);
const graveyardNames = (g: Game) => names(g.player1.graveyard);
const supportNames = (g: Game) =>
  names(g.player1.supportZones.filter((s) => s !== null));

describe('Protocole Delta .core', () => {
  it('ne gagne pas de compteur au début du tour', () => {
    const g = setupWithCharge('Protocole Delta .core');
    startTurn(g);
    expect(chargeOf(g).chargeCounters).toBe(0);
  });
  it('+1 compteur par équipement posé', () => {
    const g = setupWithCharge('Protocole Delta .core', {
      hand: ['Firewall .sys'],
      board: ['Noyau Alpha'],
    });
    equip(g, 'Firewall .sys', 'Noyau Alpha');
    expect(chargeOf(g).chargeCounters).toBe(1);
  });
  it('à 4 : invoque Delta depuis la main en priorité', () => {
    const g = setupWithCharge('Protocole Delta .core', {
      counters: 3,
      hand: ['Noyau Delta', 'Firewall .sys'],
      deck: ['Noyau Delta'],
      board: ['Noyau Alpha'],
    });
    equip(g, 'Firewall .sys', 'Noyau Alpha');
    confirmPick(g);
    expect(boardNames(g)).toContain('Noyau Delta');
    expect(handNames(g)).not.toContain('Noyau Delta');
    expect(deckNames(g)).toContain('Noyau Delta');
    expect(supportNames(g)).not.toContain('Protocole Delta .core');
  });
  it('à 4 sans Delta en main : le prend dans le deck', () => {
    const g = setupWithCharge('Protocole Delta .core', {
      counters: 3,
      hand: ['Firewall .sys'],
      deck: ['Noyau Delta'],
      board: ['Noyau Alpha'],
    });
    equip(g, 'Firewall .sys', 'Noyau Alpha');
    confirmPick(g);
    expect(boardNames(g)).toContain('Noyau Delta');
  });
  it('terrain plein (3 monstres) : sacrifie le monstre choisi puis invoque Delta à sa place', () => {
    const g = setupWithCharge('Protocole Delta .core', {
      counters: 3,
      hand: ['Firewall .sys'],
      deck: ['Noyau Delta'],
      board: ['Noyau Alpha', 'Noyau Beta', 'Noyau Zeta'],
    });
    equip(g, 'Firewall .sys', 'Noyau Alpha');
    expect(g.pendingChoices[0].resolution).toBe('sacrifice_for_summon');
    pickByName(g, 'Noyau Beta');
    expect(boardNames(g)).toEqual(['Noyau Alpha', 'Noyau Delta', 'Noyau Zeta']);
    expect(graveyardNames(g)).toContain('Noyau Beta');
    expect(graveyardNames(g)).toContain('Protocole Delta .core');
  });
  it('sans Delta en main ni dans le deck : sans effet, la Charge part au cimetière', () => {
    const g = setupWithCharge('Protocole Delta .core', {
      counters: 3,
      hand: ['Firewall .sys'],
      board: ['Noyau Alpha'],
    });
    equip(g, 'Firewall .sys', 'Noyau Alpha');
    expect(g.pendingChoices).toHaveLength(0);
    expect(graveyardNames(g)).toContain('Protocole Delta .core');
  });
});
